import "server-only";

import type { Actor } from "@/lib/auth/actor";
import { prisma } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import type { RequestContext } from "@/lib/security/request-context";
import { writeAuditLog } from "@/modules/audit/audit.service";

export async function listJobs(
  actor: Actor,
  status?: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED",
) {
  if (!["ADMIN", "MANAGER"].includes(actor.role)) {
    throw new AppError("FORBIDDEN");
  }
  return prisma.job.findMany({
    where: { status },
    select: {
      id: true,
      type: true,
      status: true,
      attempts: true,
      maxAttempts: true,
      scheduledAt: true,
      startedAt: true,
      completedAt: true,
      errorMessage: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function retryJob(
  actor: Actor,
  jobId: string,
  reason: string,
  context?: RequestContext,
) {
  if (!["ADMIN", "MANAGER"].includes(actor.role)) {
    throw new AppError("FORBIDDEN");
  }
  return prisma.$transaction(async (tx) => {
    const job = await tx.job.findUnique({ where: { id: jobId } });
    if (!job) throw new AppError("NOT_FOUND");
    if (job.status !== "FAILED") {
      throw new AppError("CONFLICT", "Chỉ có thể chạy lại job đã thất bại.");
    }
    const updated = await tx.job.update({
      where: { id: jobId },
      data: {
        status: "PENDING",
        attempts: 0,
        scheduledAt: new Date(),
        startedAt: null,
        completedAt: null,
        lockedAt: null,
        lockedBy: null,
        errorMessage: null,
      },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "JOB_RETRIED",
      entityType: "Job",
      entityId: jobId,
      oldValue: job,
      newValue: updated,
      reason,
      context,
    });
    return updated;
  });
}
