import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { fileTypeFromBuffer } from "file-type";

import { env } from "@/config/env";
import type { AssetCategory } from "@/generated/prisma/enums";
import { AppError } from "@/lib/errors/app-error";

const allowedMimeByCategory: Record<AssetCategory, ReadonlySet<string>> = {
  RECORDING: new Set([
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-matroska",
  ]),
  DOCUMENT: new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/plain",
  ]),
  SUBMISSION: new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/plain",
  ]),
  IMAGE: new Set(["image/jpeg", "image/png", "image/webp"]),
  THUMBNAIL: new Set(["image/jpeg", "image/png", "image/webp"]),
  REPORT: new Set([
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]),
  TEMP: new Set([
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-matroska",
    "application/octet-stream",
  ]),
};

const blockedExtensions = new Set([
  "exe",
  "dll",
  "com",
  "bat",
  "cmd",
  "ps1",
  "sh",
  "msi",
  "jar",
  "scr",
  "php",
  "js",
  "mjs",
  "cjs",
  "html",
  "svg",
]);

const categoryDirectory: Record<AssetCategory, string> = {
  RECORDING: env.RECORDINGS_DIR,
  DOCUMENT: env.DOCUMENTS_DIR,
  SUBMISSION: env.SUBMISSIONS_DIR,
  IMAGE: env.IMAGES_DIR,
  THUMBNAIL: env.THUMBNAILS_DIR,
  REPORT: env.REPORTS_DIR,
  TEMP: env.TEMP_DIR,
};

const maximumBytesByCategory: Record<AssetCategory, number> = {
  RECORDING: env.MAX_VIDEO_SIZE_MB * 1024 * 1024,
  DOCUMENT: env.MAX_DOCUMENT_SIZE_MB * 1024 * 1024,
  SUBMISSION: env.MAX_SUBMISSION_SIZE_MB * 1024 * 1024,
  IMAGE: env.MAX_DOCUMENT_SIZE_MB * 1024 * 1024,
  THUMBNAIL: env.MAX_DOCUMENT_SIZE_MB * 1024 * 1024,
  REPORT: env.MAX_DOCUMENT_SIZE_MB * 1024 * 1024,
  TEMP: env.MAX_VIDEO_SIZE_MB * 1024 * 1024,
};

function normalizeExtension(filename: string) {
  return path.extname(filename).slice(1).toLowerCase();
}

function protectedStorageKey(destination: string) {
  const root = path.resolve(env.UPLOAD_ROOT);
  if (!destination.startsWith(`${root}${path.sep}`)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Thư mục lưu file phải nằm trong UPLOAD_ROOT.",
    );
  }
  return path.relative(root, destination).split(path.sep).join("/");
}

export async function inspectUpload(input: {
  category: AssetCategory;
  originalName: string;
  claimedMimeType?: string | null;
  buffer: Buffer;
}) {
  if (input.buffer.byteLength === 0) {
    throw new AppError("VALIDATION_ERROR", "File tải lên đang trống.");
  }
  if (input.buffer.byteLength > maximumBytesByCategory[input.category]) {
    throw new AppError(
      "VALIDATION_ERROR",
      "File vượt quá dung lượng cho phép.",
    );
  }

  const originalExtension = normalizeExtension(input.originalName);
  if (blockedExtensions.has(originalExtension)) {
    throw new AppError("VALIDATION_ERROR", "Loại file này không được phép.");
  }

  const detected = await fileTypeFromBuffer(input.buffer);
  const detectedMime =
    detected?.mime ??
    (input.claimedMimeType === "text/plain" ? "text/plain" : null) ??
    (input.claimedMimeType === "text/csv" ? "text/csv" : null);

  if (
    !detectedMime ||
    !allowedMimeByCategory[input.category].has(detectedMime)
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Nội dung file không khớp loại file được cho phép.",
    );
  }

  if (
    input.claimedMimeType &&
    !["application/octet-stream", detectedMime].includes(input.claimedMimeType)
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "MIME khai báo không khớp nội dung thực tế.",
    );
  }

  const safeExtension =
    detected?.ext ?? (detectedMime === "text/csv" ? "csv" : "txt");
  const storageName = `${randomUUID()}.${safeExtension}`;
  const checksum = createHash("sha256").update(input.buffer).digest("hex");

  return {
    mimeType: detectedMime,
    sizeBytes: BigInt(input.buffer.byteLength),
    storageName,
    checksum,
  };
}

export async function persistProtectedUpload(input: {
  category: AssetCategory;
  storageName: string;
  buffer: Buffer;
}) {
  const directory = path.resolve(categoryDirectory[input.category]);
  const destination = path.resolve(directory, input.storageName);
  if (!destination.startsWith(`${directory}${path.sep}`)) {
    throw new AppError("VALIDATION_ERROR", "Đường dẫn lưu file không hợp lệ.");
  }
  const storageKey = protectedStorageKey(destination);

  await mkdir(directory, { recursive: true });
  await writeFile(destination, input.buffer, { flag: "wx", mode: 0o644 });

  return storageKey;
}

export async function persistStreamingVideoUpload(input: {
  body: ReadableStream<Uint8Array> | null;
  originalName: string;
  claimedMimeType?: string | null;
  declaredSize?: number;
}) {
  if (!input.body) {
    throw new AppError("VALIDATION_ERROR", "Nội dung video đang trống.");
  }

  const originalExtension = normalizeExtension(input.originalName);
  if (blockedExtensions.has(originalExtension)) {
    throw new AppError("VALIDATION_ERROR", "Loại file này không được phép.");
  }

  const maximumBytes = maximumBytesByCategory.RECORDING;
  if (
    input.declaredSize !== undefined &&
    (input.declaredSize <= 0 || input.declaredSize > maximumBytes)
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "File vượt quá dung lượng cho phép hoặc đang trống.",
    );
  }

  const temporaryDirectory = path.resolve(env.TEMP_DIR);
  const temporaryPath = path.resolve(
    temporaryDirectory,
    `${randomUUID()}.upload`,
  );
  if (!temporaryPath.startsWith(`${temporaryDirectory}${path.sep}`)) {
    throw new AppError("VALIDATION_ERROR", "Đường dẫn tạm không hợp lệ.");
  }

  await mkdir(temporaryDirectory, { recursive: true, mode: 0o755 });
  const handle = await open(temporaryPath, "wx", 0o644);
  const reader = input.body.getReader();
  const checksum = createHash("sha256");
  const signatureChunks: Buffer[] = [];
  let signatureBytes = 0;
  let totalBytes = 0;
  let streamCompleted = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        streamCompleted = true;
        break;
      }
      if (!value?.byteLength) {
        continue;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        throw new AppError(
          "VALIDATION_ERROR",
          "File vượt quá dung lượng cho phép.",
        );
      }

      checksum.update(value);
      if (signatureBytes < 65_536) {
        const remaining = 65_536 - signatureBytes;
        const signaturePart = Buffer.from(
          value.buffer,
          value.byteOffset,
          Math.min(value.byteLength, remaining),
        );
        signatureChunks.push(Buffer.from(signaturePart));
        signatureBytes += signaturePart.byteLength;
      }
      let offset = 0;
      while (offset < value.byteLength) {
        const { bytesWritten } = await handle.write(
          value,
          offset,
          value.byteLength - offset,
        );
        if (bytesWritten === 0) {
          throw new AppError(
            "INTERNAL_ERROR",
            "Không thể ghi tiếp dữ liệu video.",
          );
        }
        offset += bytesWritten;
      }
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    try {
      await handle.close();
    } finally {
      if (!streamCompleted) {
        await rm(temporaryPath, { force: true });
      }
    }
  }

  try {
    if (totalBytes === 0) {
      throw new AppError("VALIDATION_ERROR", "Nội dung video đang trống.");
    }
    if (input.declaredSize !== undefined && totalBytes !== input.declaredSize) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Dung lượng video không khớp dữ liệu đã nhận.",
      );
    }

    const detected = await fileTypeFromBuffer(Buffer.concat(signatureChunks));
    if (!detected || !allowedMimeByCategory.RECORDING.has(detected.mime)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Nội dung file không phải định dạng video được cho phép.",
      );
    }
    if (
      input.claimedMimeType &&
      !["application/octet-stream", detected.mime].includes(
        input.claimedMimeType,
      )
    ) {
      throw new AppError(
        "VALIDATION_ERROR",
        "MIME khai báo không khớp nội dung thực tế.",
      );
    }

    const recordingDirectory = path.resolve(env.RECORDINGS_DIR);
    const storageName = `${randomUUID()}.${detected.ext}`;
    const destination = path.resolve(recordingDirectory, storageName);
    if (!destination.startsWith(`${recordingDirectory}${path.sep}`)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Đường dẫn lưu file không hợp lệ.",
      );
    }
    const storageKey = protectedStorageKey(destination);

    await mkdir(recordingDirectory, { recursive: true, mode: 0o755 });
    await rename(temporaryPath, destination);
    return {
      storageKey,
      mimeType: detected.mime,
      sizeBytes: BigInt(totalBytes),
      checksum: checksum.digest("hex"),
    };
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

export function resolveProtectedStoragePath(storageKey: string) {
  if (!storageKey || storageKey.includes("\0") || path.isAbsolute(storageKey)) {
    throw new AppError("VALIDATION_ERROR", "Khóa lưu trữ không hợp lệ.");
  }

  const root = path.resolve(env.UPLOAD_ROOT);
  const resolved = path.resolve(root, storageKey);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new AppError("FORBIDDEN");
  }
  return resolved;
}

export async function removeProtectedUpload(storageKey: string) {
  await rm(resolveProtectedStoragePath(storageKey), { force: true });
}

export function nginxInternalPath(storageKey: string) {
  resolveProtectedStoragePath(storageKey);
  return `/protected/${storageKey
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}
