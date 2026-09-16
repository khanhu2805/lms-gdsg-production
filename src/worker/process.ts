import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import type { JobType, ReportType } from "@/generated/prisma/enums";
import { env } from "@/config/env";
import { prisma } from "@/lib/database/client";

type JsonObject = Record<string, unknown>;
import { pathToFileURL } from "node:url";
const OFFICE_PREVIEW_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
function payloadObject(payload: unknown): JsonObject {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    throw new Error("Payload của job không hợp lệ.");
  }
  return payload as JsonObject;
}

function requiredString(payload: JsonObject, key: string) {
  const value = payload[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Payload thiếu trường ${key}.`);
  }
  return value;
}

function safeStoragePath(storageKey: string) {
  if (!storageKey || path.isAbsolute(storageKey) || storageKey.includes("\0")) {
    throw new Error("Khóa lưu trữ không hợp lệ.");
  }
  const root = path.resolve(env.UPLOAD_ROOT);
  const resolved = path.resolve(root, storageKey);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Đường dẫn nằm ngoài vùng lưu trữ được bảo vệ.");
  }
  return resolved;
}

async function directorySizeBytes(directory: string): Promise<bigint> {
  const entries = await readdir(directory, {
    withFileTypes: true,
  });

  let total = 0n;

  for (const entry of entries) {
    const target = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      total += await directorySizeBytes(target);
      continue;
    }

    if (entry.isFile()) {
      const fileStat = await stat(target);

      total += BigInt(fileStat.size);
    }
  }

  return total;
}

async function runProcess(
  executable: string,
  args: string[],
  captureOutput = false,
) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      stdio: captureOutput
        ? ["ignore", "pipe", "pipe"]
        : ["ignore", "ignore", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      if (stdout.length < 2_000_000) stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < 32_000) stderr += chunk.toString("utf8");
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve(stdout);
      else
        reject(
          new Error(
            `${path.basename(executable)} kết thúc với mã ${code}: ${stderr.slice(-4000)}`,
          ),
        );
    });
  });
}

type ProbeOutput = {
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
  }>;
  format?: { duration?: string };
};
async function generateDocumentPreview(materialId: string) {
  const material = await prisma.material.findUnique({
    where: {
      id: materialId,
    },
    include: {
      asset: true,
    },
  });

  if (!material) {
    throw new Error("Không tìm thấy tài liệu.");
  }

  if (material.asset.status !== "READY" || material.asset.deletedAt) {
    throw new Error("File tài liệu nguồn không sẵn sàng.");
  }

  /*
   * PDF / hình / text không cần LibreOffice.
   * Dùng luôn file gốc làm bản xem.
   */
  if (!OFFICE_PREVIEW_MIME_TYPES.has(material.mimeType)) {
    await prisma.material.update({
      where: {
        id: material.id,
      },
      data: {
        previewStatus: "READY",
        previewStorageKey: material.asset.storageKey,
        previewError: null,
      },
    });

    return {
      materialId: material.id,
      converted: false,
      previewStorageKey: material.asset.storageKey,
    };
  }

  await prisma.material.update({
    where: {
      id: material.id,
    },
    data: {
      previewStatus: "PROCESSING",
      previewError: null,
    },
  });

  const sourcePath = safeStoragePath(material.asset.storageKey);

  await stat(sourcePath);

  /*
   * LibreOffice chuyển file ở thư mục tạm trước.
   */
  const temporaryDirectory = safeStoragePath(
    `temp/material-preview-${material.id}-${randomUUID()}`,
  );

  const libreOfficeProfileDirectory = path.join(
    temporaryDirectory,
    "libreoffice-profile",
  );

  /*
   * PDF hoàn chỉnh được đưa vào đây.
   */
  const previewDirectory = safeStoragePath("documents/previews");

  await mkdir(temporaryDirectory, {
    recursive: true,
    mode: 0o755,
  });

  await mkdir(libreOfficeProfileDirectory, {
    recursive: true,
    mode: 0o755,
  });

  await mkdir(previewDirectory, {
    recursive: true,
    mode: 0o755,
  });

  try {
    await runProcess(
      "libreoffice",
      [
        "--headless",
        "--nologo",
        "--nodefault",
        "--nolockcheck",
        "--nofirststartwizard",

        `-env:UserInstallation=${
          pathToFileURL(libreOfficeProfileDirectory).href
        }`,

        "--convert-to",
        "pdf",

        "--outdir",
        temporaryDirectory,

        sourcePath,
      ],
      true,
    );

    /*
     * File nguồn được LMS lưu với UUID, ví dụ:
     *
     * documents/123.docx
     *
     * LibreOffice sinh:
     *
     * 123.pdf
     */
    const generatedPdfPath = path.join(
      temporaryDirectory,
      `${path.parse(sourcePath).name}.pdf`,
    );

    const generatedPdfStat = await stat(generatedPdfPath);

    if (!generatedPdfStat.isFile() || generatedPdfStat.size <= 0) {
      throw new Error("LibreOffice không tạo được file PDF hợp lệ.");
    }

    const previewStorageKey = `documents/previews/${randomUUID()}.pdf`;

    const destination = safeStoragePath(previewStorageKey);

    await rename(generatedPdfPath, destination);

    /*
     * Nginx cần đọc được PDF qua /protected/.
     */
    await chmod(destination, 0o644);

    await prisma.material.update({
      where: {
        id: material.id,
      },
      data: {
        previewStatus: "READY",
        previewStorageKey,
        previewError: null,
      },
    });

    return {
      materialId: material.id,
      converted: true,
      previewStorageKey,
      sizeBytes: generatedPdfStat.size,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await prisma.material.updateMany({
      where: {
        id: material.id,
      },
      data: {
        previewStatus: "FAILED",
        previewError: message.slice(0, 2000),
      },
    });

    throw error;
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
}
async function processVideo(recordingId: string) {
  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    include: {
      asset: true,
      content: { select: { title: true } },
    },
  });
  if (!recording) throw new Error("Không tìm thấy bản ghi video.");
  if (recording.processingStatus === "READY" && recording.hlsManifestKey) {
    return {
      recordingId: recording.id,

      hlsManifestKey: recording.hlsManifestKey,

      alreadyProcessed: true,
    };
  }
  if (recording.asset.status !== "READY" || recording.asset.deletedAt) {
    throw new Error("File video nguồn không sẵn sàng.");
  }

  const sourceStorageKey = recording.asset.storageKey;
  const sourcePath = safeStoragePath(sourceStorageKey);
  await stat(sourcePath);
  const hlsDirectory = safeStoragePath(`recordings/hls/${recording.id}`);
  const thumbnailKey = `thumbnails/${randomUUID()}.jpg`;
  const thumbnailPath = safeStoragePath(thumbnailKey);
  await Promise.all([
    mkdir(hlsDirectory, { recursive: true }),
    mkdir(path.dirname(thumbnailPath), { recursive: true }),
  ]);

  const probeJson = await runProcess(
    env.FFPROBE_PATH,
    ["-v", "error", "-show_streams", "-show_format", "-of", "json", sourcePath],
    true,
  );
  const probe = JSON.parse(probeJson) as ProbeOutput;
  const videoStream = probe.streams?.find(
    (stream) => stream.codec_type === "video",
  );
  const durationSeconds = Math.max(
    1,
    Math.round(Number(probe.format?.duration ?? 0)),
  );
  if (!videoStream?.width || !videoStream.height || !durationSeconds) {
    throw new Error("Không đọc được thông tin video bằng ffprobe.");
  }

  await runProcess(env.FFMPEG_PATH, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    sourcePath,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-vf",
    "scale='min(1280,iw)':-2",

    "-c:v",
    "libx264",

    "-preset",
    "veryfast",

    "-crf",
    "27",

    "-c:a",
    "aac",

    "-b:a",
    "96k",
    "-hls_time",
    "6",
    "-hls_playlist_type",
    "vod",
    "-hls_segment_filename",
    path.join(hlsDirectory, "segment-%05d.ts"),
    path.join(hlsDirectory, "index.m3u8"),
  ]);
  await runProcess(env.FFMPEG_PATH, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    String(Math.min(5, Math.max(0, durationSeconds / 10))),
    "-i",
    sourcePath,
    "-frames:v",
    "1",
    "-vf",
    "scale='min(1280,iw)':-2",
    thumbnailPath,
  ]);

  const thumbnailBuffer = await readFile(thumbnailPath);

  const thumbnailChecksum = createHash("sha256")
    .update(thumbnailBuffer)
    .digest("hex");

  const hlsManifestKey = `recordings/hls/${recording.id}/index.m3u8`;

  const hlsSizeBytes = await directorySizeBytes(hlsDirectory);

  const hlsManifestPath = safeStoragePath(hlsManifestKey);

  const hlsManifestBuffer = await readFile(hlsManifestPath);

  const hlsChecksum = createHash("sha256")
    .update(hlsManifestBuffer)
    .digest("hex");

  await prisma.$transaction(async (tx) => {
    const thumbnail = await tx.asset.create({
      data: {
        category: "THUMBNAIL",
        storageKey: thumbnailKey,
        originalName: `${recording.content.title}.jpg`,
        mimeType: "image/jpeg",
        sizeBytes: BigInt(thumbnailBuffer.byteLength),
        checksum: thumbnailChecksum,
        status: "READY",
        uploadedById: recording.asset.uploadedById,
      },
    });
    await tx.asset.update({
      where: {
        id: recording.assetId,
      },

      data: {
        storageKey: hlsManifestKey,

        mimeType: "application/vnd.apple.mpegurl",

        sizeBytes: hlsSizeBytes,

        checksum: hlsChecksum,

        status: "READY",

        deletedAt: null,
      },
    });
    await tx.recording.update({
      where: { id: recording.id },
      data: {
        thumbnailAssetId: thumbnail.id,
        hlsManifestKey,
        processingStatus: "READY",
        durationSeconds,
        width: videoStream.width,
        height: videoStream.height,
        codec: videoStream.codec_name,
        errorMessage: null,
      },
    });
    await tx.job.create({
      data: {
        type: "DELETE_FILE",

        payload: {
          storageKey: sourceStorageKey,
        },
      },
    });
  });
  return {
    recordingId,
    durationSeconds,
    width: videoStream.width,
    height: videoStream.height,
    hlsManifestKey,
    sizeBytes: hlsSizeBytes.toString(),
  };
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const normalized =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "\uFEFFKhông có dữ liệu\r\n";
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return `\uFEFF${columns.map(csvCell).join(",")}\r\n${rows
    .map((row) => columns.map((column) => csvCell(row[column])).join(","))
    .join("\r\n")}\r\n`;
}

async function reportRows(
  type: ReportType,
  parameters: JsonObject,
): Promise<Array<Record<string, unknown>>> {
  const classId =
    typeof parameters.classId === "string" ? parameters.classId : undefined;

  switch (type) {
    case "USERS":
      return (await prisma.user.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      })) as Array<Record<string, unknown>>;
    case "CLASSES":
    case "CAPACITY":
      return (
        await prisma.courseClass.findMany({
          where: classId ? { id: classId } : {},
          select: {
            code: true,
            name: true,
            academicYear: true,
            mode: true,
            capacity: true,
            status: true,
            startDate: true,
            endDate: true,
            _count: {
              select: {
                students: { where: { status: "ACTIVE" } },
              },
            },
          },
          orderBy: { code: "asc" },
        })
      ).map((row) => ({
        ...row,
        activeStudents: row._count.students,
        overCapacity: row._count.students > row.capacity,
        _count: undefined,
      }));
    case "ATTENDANCE":
      return (
        await prisma.attendance.findMany({
          where: classId ? { classSession: { classId } } : {},
          select: {
            status: true,
            source: true,
            firstJoinClickedAt: true,
            markedAt: true,
            note: true,
            student: { select: { email: true, name: true } },
            classSession: {
              select: {
                sessionNumber: true,
                title: true,
                courseClass: { select: { code: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      ).map((row) => ({
        classCode: row.classSession.courseClass.code,
        sessionNumber: row.classSession.sessionNumber,
        sessionTitle: row.classSession.title,
        studentName: row.student.name,
        studentEmail: row.student.email,
        status: row.status,
        source: row.source,
        firstJoinClickedAt: row.firstJoinClickedAt,
        markedAt: row.markedAt,
        note: row.note,
      }));
    case "ASSIGNMENTS":
      return (
        await prisma.submission.findMany({
          where: classId ? { assignment: { content: { classId } } } : {},
          select: {
            attemptNumber: true,
            status: true,
            submittedAt: true,
            isLate: true,
            finalScore: true,
            student: { select: { email: true, name: true } },
            assignment: {
              select: { content: { select: { title: true } } },
            },
          },
          orderBy: { submittedAt: "desc" },
        })
      ).map((row) => ({
        assignment: row.assignment.content.title,
        studentName: row.student.name,
        studentEmail: row.student.email,
        attemptNumber: row.attemptNumber,
        status: row.status,
        submittedAt: row.submittedAt,
        isLate: row.isLate,
        finalScore: row.finalScore?.toString(),
      }));
    case "QUIZZES":
      return (
        await prisma.quizAttempt.findMany({
          where: classId ? { quiz: { content: { classId } } } : {},
          select: {
            attemptNumber: true,
            status: true,
            startedAt: true,
            submittedAt: true,
            finalScore: true,
            student: { select: { email: true, name: true } },
            quiz: { select: { content: { select: { title: true } } } },
          },
          orderBy: { startedAt: "desc" },
        })
      ).map((row) => ({
        quiz: row.quiz.content.title,
        studentName: row.student.name,
        studentEmail: row.student.email,
        attemptNumber: row.attemptNumber,
        status: row.status,
        startedAt: row.startedAt,
        submittedAt: row.submittedAt,
        finalScore: row.finalScore?.toString(),
      }));
    case "PROGRESS":
    case "VIDEO":
      return (
        await prisma.videoProgress.findMany({
          where: classId ? { recording: { content: { classId } } } : {},
          select: {
            currentTimeSeconds: true,
            durationSeconds: true,
            totalWatchedSeconds: true,
            percentage: true,
            completed: true,
            lastViewedAt: true,
            user: { select: { email: true, name: true } },
            recording: {
              select: { content: { select: { title: true } } },
            },
          },
          orderBy: { lastViewedAt: "desc" },
        })
      ).map((row) => ({
        video: row.recording.content.title,
        studentName: row.user.name,
        studentEmail: row.user.email,
        currentTimeSeconds: row.currentTimeSeconds,
        durationSeconds: row.durationSeconds,
        totalWatchedSeconds: row.totalWatchedSeconds,
        percentage: row.percentage.toString(),
        completed: row.completed,
        lastViewedAt: row.lastViewedAt,
      }));
    case "STORAGE":
      return (
        await prisma.asset.groupBy({
          by: ["category", "status"],
          _count: { id: true },
          _sum: { sizeBytes: true },
          orderBy: { category: "asc" },
        })
      ).map((row) => ({
        category: row.category,
        status: row.status,
        fileCount: row._count.id,
        sizeBytes: row._sum.sizeBytes?.toString() ?? "0",
      }));
    case "FAILED_JOBS":
      return (await prisma.job.findMany({
        where: { status: "FAILED" },
        select: {
          id: true,
          type: true,
          attempts: true,
          maxAttempts: true,
          errorMessage: true,
          createdAt: true,
          completedAt: true,
        },
        orderBy: { createdAt: "desc" },
      })) as Array<Record<string, unknown>>;
  }
}

async function generateReport(reportId: string) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
  });
  if (!report) throw new Error("Không tìm thấy yêu cầu báo cáo.");

  await prisma.report.update({
    where: { id: reportId },
    data: { status: "PROCESSING", errorMessage: null },
  });

  try {
    const parameters = payloadObject(report.parameters);
    const rows = await reportRows(report.type, parameters);
    const content = Buffer.from(toCsv(rows), "utf8");
    const storageKey = `reports/${randomUUID()}.csv`;
    const destination = safeStoragePath(storageKey);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content, { flag: "wx", mode: 0o640 });
    const checksum = createHash("sha256").update(content).digest("hex");

    const asset = await prisma.$transaction(async (tx) => {
      const created = await tx.asset.create({
        data: {
          category: "REPORT",
          storageKey,
          originalName: `${report.type.toLowerCase()}-${report.id}.csv`,
          mimeType: "text/csv",
          sizeBytes: BigInt(content.byteLength),
          checksum,
          status: "READY",
          uploadedById: report.requestedById,
        },
      });
      await tx.report.update({
        where: { id: reportId },
        data: {
          status: "READY",
          fileAssetId: created.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          errorMessage: null,
        },
      });
      return created;
    });

    return { reportId, assetId: asset.id, rowCount: rows.length };
  } catch (error) {
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: "FAILED",
        errorMessage:
          error instanceof Error ? error.message.slice(0, 2000) : String(error),
      },
    });
    throw error;
  }
}

async function finalizeAttendance(sessionId: string) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.classSession.findUnique({
      where: { id: sessionId },
      select: { id: true, classId: true, endAt: true, status: true },
    });
    if (!session) throw new Error("Không tìm thấy buổi học.");
    if (session.status === "CANCELLED") return { skipped: true };
    if (session.endAt > new Date()) throw new Error("Buổi học chưa kết thúc.");

    const students = await tx.classStudent.findMany({
      where: { classId: session.classId, status: "ACTIVE" },
      select: { studentId: true },
    });
    let finalized = 0;
    for (const { studentId } of students) {
      const exists = await tx.attendance.findUnique({
        where: {
          classSessionId_studentId: {
            classSessionId: sessionId,
            studentId,
          },
        },
        select: { id: true },
      });
      if (!exists) {
        const attendance = await tx.attendance.create({
          data: {
            classSessionId: sessionId,
            studentId,
            status: "ABSENT",
            source: "SYSTEM_FINALIZED",
            markedAt: new Date(),
            note: "Tự động xác định sau khi buổi học kết thúc.",
          },
        });
        await tx.attendanceAudit.create({
          data: {
            attendanceId: attendance.id,
            actorRole: "ADMIN",
            newStatus: "ABSENT",
            newNote: attendance.note,
            reason: "Worker hoàn tất điểm danh sau buổi học.",
          },
        });
        finalized += 1;
      }
    }
    await tx.classSession.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
        attendanceOpen: false,
        attendanceClosedAt: new Date(),
      },
    });
    return { finalized };
  });
}

async function deleteProtectedFile(payload: JsonObject) {
  const assetId =
    typeof payload.assetId === "string" ? payload.assetId : undefined;

  const asset = assetId
    ? await prisma.asset.findUnique({
        where: { id: assetId },
      })
    : null;

  const storageKey = asset?.storageKey ?? requiredString(payload, "storageKey");

  const recursive = payload.recursive === true;

  const target = safeStoragePath(storageKey);

  await rm(target, {
    force: true,
    recursive,
  });

  if (asset) {
    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        status: "DELETED",
        deletedAt: new Date(),
      },
    });
  }

  return {
    storageKey,
    deleted: true,
    recursive,
  };
}

async function cleanTempFiles() {
  const tempDirectory = safeStoragePath("temp");
  await mkdir(tempDirectory, { recursive: true });
  const entries = await readdir(tempDirectory, { withFileTypes: true });
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const target = path.join(tempDirectory, entry.name);
    const details = await stat(target);
    if (details.mtimeMs < cutoff) {
      await rm(target, { force: true });
      removed += 1;
    }
  }
  return { removed };
}

export async function processJob(type: JobType, rawPayload: unknown) {
  const payload = payloadObject(rawPayload);
  switch (type) {
    case "PROCESS_VIDEO":
    case "CREATE_THUMBNAIL":
    case "GENERATE_HLS":
      return processVideo(requiredString(payload, "recordingId"));
    case "GENERATE_REPORT":
      return generateReport(requiredString(payload, "reportId"));
    case "FINALIZE_ATTENDANCE":
      return finalizeAttendance(requiredString(payload, "sessionId"));
    case "DELETE_FILE":
      return deleteProtectedFile(payload);
    case "CLEAN_TEMP_FILES":
      return cleanTempFiles();
    case "GENERATE_DOCUMENT_PREVIEW":
      return generateDocumentPreview(requiredString(payload, "materialId"));
  }
}
