import "server-only";

import { env } from "@/config/env";
import type { Actor } from "@/lib/auth/actor";
import { assertClassAccess } from "@/lib/authorization/class-access";
import { prisma } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import { nginxInternalPath } from "@/lib/storage/file-policy";

export async function authorizeRecordingPlayback(
  actor: Actor,
  recordingId: string,
  metadata?: { ipAddress?: string | null; userAgent?: string | null },
  existingViewSessionId?: string,
) {
  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    include: {
      content: {
        select: {
          id: true,
          classId: true,
          publicationStatus: true,
        },
      },
      asset: {
        select: {
          storageKey: true,
          mimeType: true,
          status: true,
        },
      },
    },
  });
  if (!recording) throw new AppError("NOT_FOUND");
  await assertClassAccess(actor, recording.content.classId);

  if (
    ["STUDENT", "PARENT"].includes(actor.role) &&
    recording.content.publicationStatus !== "PUBLISHED"
  ) {
    throw new AppError("FORBIDDEN");
  }
  if (
    recording.processingStatus !== "READY" ||
    (!recording.hlsManifestKey && recording.asset.status !== "READY")
  ) {
    throw new AppError("CONFLICT", "Video chưa sẵn sàng để phát.");
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - 90_000);

  let session: { id: string } | null = null;

  /*
   * Nếu browser gửi lại viewSessionId của chính nó,
   * tiếp tục sử dụng phiên đó thay vì tạo phiên mới.
   *
   * Không buộc recordingId phải giống nhau:
   * cùng browser có thể chuyển sang video khác và
   * vẫn sử dụng một phiên xem duy nhất.
   */
  if (existingViewSessionId) {
    const existingSession = await prisma.videoViewSession.findFirst({
      where: {
        id: existingViewSessionId,
        userId: actor.id,
        status: "ACTIVE",
        lastSeenAt: {
          gt: cutoff,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingSession) {
      await prisma.videoViewSession.update({
        where: {
          id: existingSession.id,
        },
        data: {
          recordingId,
          lastSeenAt: now,
        },
      });

      session = {
        id: existingSession.id,
      };
    }
  }

  if (!session) {
    session = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtext(${`video:${actor.id}`})
        )
      `;

        /*
         * Dọn các phiên quá 90 giây.
         */
        await tx.videoViewSession.updateMany({
          where: {
            userId: actor.id,
            status: "ACTIVE",
            lastSeenAt: {
              lte: cutoff,
            },
          },
          data: {
            status: "ENDED",
            endedAt: now,
          },
        });

        const activeSessions = await tx.videoViewSession.count({
          where: {
            userId: actor.id,
            status: "ACTIVE",
            lastSeenAt: {
              gt: cutoff,
            },
          },
        });

        if (activeSessions >= env.MAX_CONCURRENT_VIDEO_SESSIONS) {
          throw new AppError(
            "CONFLICT",
            "Tài khoản đã đạt giới hạn phiên xem video đồng thời.",
          );
        }

        return tx.videoViewSession.create({
          data: {
            userId: actor.id,
            recordingId,
            ipAddress: metadata?.ipAddress,
            userAgent: metadata?.userAgent,
          },
          select: {
            id: true,
          },
        });
      },
      {
        isolationLevel: "Serializable",
      },
    );
  } else {
    await prisma.videoViewSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });
  }
  const profile = await prisma.profile.findUnique({
    where: { userId: actor.id },
    select: {
      studentCode: true,
      teacherCode: true,
      assistantCode: true,
      parentCode: true,
    },
  });

  const storageKey = recording.hlsManifestKey ?? recording.asset.storageKey;
  return {
    internalPath: nginxInternalPath(storageKey),
    hlsManifestKey: recording.hlsManifestKey,
    mimeType: recording.hlsManifestKey
      ? "application/vnd.apple.mpegurl"
      : recording.asset.mimeType,
    viewSessionId: session.id,
    watermark: {
      viewerName: actor.name,
      viewerCode:
        profile?.studentCode ??
        profile?.teacherCode ??
        profile?.assistantCode ??
        profile?.parentCode ??
        actor.id.slice(0, 8).toUpperCase(),
      maskedEmail: maskEmail(actor.email),
      timestamp: new Date().toISOString(),
      sessionCode: session.id.slice(0, 8).toUpperCase(),
    },
  };
}

export async function authorizeRecordingSegment(
  actor: Actor,
  recordingId: string,
  segment: string,
  viewSessionId: string,
) {
  if (!/^segment-\d{5}\.ts$/.test(segment)) {
    throw new AppError("NOT_FOUND");
  }
  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: {
      processingStatus: true,
      hlsManifestKey: true,
      content: {
        select: { classId: true, publicationStatus: true },
      },
    },
  });
  if (!recording?.hlsManifestKey || recording.processingStatus !== "READY") {
    throw new AppError("NOT_FOUND");
  }
  await assertClassAccess(actor, recording.content.classId);
  if (
    ["STUDENT", "PARENT"].includes(actor.role) &&
    recording.content.publicationStatus !== "PUBLISHED"
  ) {
    throw new AppError("FORBIDDEN");
  }
  const viewSession = await prisma.videoViewSession.findFirst({
    where: {
      id: viewSessionId,
      userId: actor.id,
      recordingId,
      status: "ACTIVE",
      lastSeenAt: { gt: new Date(Date.now() - 90_000) },
    },
    select: { id: true },
  });
  if (!viewSession) {
    throw new AppError("FORBIDDEN", "Phiên xem video không còn hiệu lực.");
  }
  await prisma.videoViewSession.update({
    where: { id: viewSession.id },
    data: { lastSeenAt: new Date() },
  });

  const segmentKey = `${recording.hlsManifestKey.slice(
    0,
    recording.hlsManifestKey.lastIndexOf("/") + 1,
  )}${segment}`;
  return nginxInternalPath(segmentKey);
}

export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "***";
  const visible = name.slice(0, Math.min(3, name.length));
  return `${visible}${"*".repeat(Math.max(2, name.length - visible.length))}@${domain}`;
}

export async function updateVideoProgress(
  actor: Actor,
  recordingId: string,
  input: {
    viewSessionId: string;
    currentTimeSeconds: number;
    durationSeconds: number;
    watchedDeltaSeconds: number;
  },
  metadata?: { ipAddress?: string | null; userAgent?: string | null },
) {
  if (actor.role !== "STUDENT") {
    throw new AppError("FORBIDDEN");
  }
  if (
    !Number.isFinite(input.currentTimeSeconds) ||
    !Number.isFinite(input.durationSeconds) ||
    !Number.isFinite(input.watchedDeltaSeconds) ||
    input.currentTimeSeconds < 0 ||
    input.durationSeconds <= 0 ||
    input.currentTimeSeconds > input.durationSeconds + 2 ||
    input.watchedDeltaSeconds < 0 ||
    input.watchedDeltaSeconds > env.VIDEO_PROGRESS_INTERVAL_SECONDS * 2
  ) {
    throw new AppError("VALIDATION_ERROR", "Tiến độ video không hợp lệ.");
  }

  const viewSession = await prisma.videoViewSession.findFirst({
    where: {
      id: input.viewSessionId,
      userId: actor.id,
      recordingId,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (!viewSession) throw new AppError("FORBIDDEN");

  const percentage = Math.min(
    100,
    (input.currentTimeSeconds / input.durationSeconds) * 100,
  );
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.videoProgress.findUnique({
      where: { userId_recordingId: { userId: actor.id, recordingId } },
      select: { totalWatchedSeconds: true },
    });
    const progress = await tx.videoProgress.upsert({
      where: { userId_recordingId: { userId: actor.id, recordingId } },
      create: {
        userId: actor.id,
        recordingId,
        currentTimeSeconds: Math.round(input.currentTimeSeconds),
        durationSeconds: Math.round(input.durationSeconds),
        totalWatchedSeconds: Math.round(input.watchedDeltaSeconds),
        percentage,
        completed: percentage >= env.VIDEO_COMPLETION_PERCENTAGE,
        lastViewedAt: now,
        lastIpAddress: metadata?.ipAddress,
        lastUserAgent: metadata?.userAgent,
      },
      update: {
        currentTimeSeconds: Math.round(input.currentTimeSeconds),
        durationSeconds: Math.round(input.durationSeconds),
        totalWatchedSeconds:
          (existing?.totalWatchedSeconds ?? 0) +
          Math.round(input.watchedDeltaSeconds),
        percentage,
        completed: percentage >= env.VIDEO_COMPLETION_PERCENTAGE,
        lastViewedAt: now,
        lastIpAddress: metadata?.ipAddress,
        lastUserAgent: metadata?.userAgent,
      },
      select: {
        currentTimeSeconds: true,
        percentage: true,
        completed: true,
      },
    });
    await tx.videoViewSession.update({
      where: { id: viewSession.id },
      data: { lastSeenAt: now },
    });
    return progress;
  });
}
