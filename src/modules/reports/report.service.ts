import "server-only";

import type { Actor } from "@/lib/auth/actor";
import { assertStaffClassAccess } from "@/lib/authorization/class-access";
import { prisma } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import type { RequestContext } from "@/lib/security/request-context";
import { writeAuditLog } from "@/modules/audit/audit.service";

import type { createReportSchema } from "./report.schemas";
import type { z } from "zod";

type CreateReportInput = z.infer<typeof createReportSchema>;

export async function requestReport(
  actor: Actor,
  input: CreateReportInput,
  context?: RequestContext,
) {
  if (!["ADMIN", "MANAGER", "TEACHER"].includes(actor.role)) {
    throw new AppError("FORBIDDEN");
  }
  if (actor.role === "TEACHER") {
    if (!input.parameters.classId) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Giáo viên phải chọn lớp khi tạo báo cáo.",
      );
    }
    await assertStaffClassAccess(actor, input.parameters.classId);
    if (
      !["ATTENDANCE", "ASSIGNMENTS", "QUIZZES", "PROGRESS", "VIDEO"].includes(
        input.type,
      )
    ) {
      throw new AppError("FORBIDDEN");
    }
  }

  return prisma.$transaction(async (tx) => {
    const report = await tx.report.create({
      data: {
        type: input.type,
        parameters: input.parameters,
        requestedById: actor.id,
      },
    });
    const job = await tx.job.create({
      data: {
        type: "GENERATE_REPORT",
        payload: { reportId: report.id },
      },
    });
    const updated = await tx.report.update({
      where: { id: report.id },
      data: { jobId: job.id },
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
      },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "REPORT_REQUESTED",
      entityType: "Report",
      entityId: report.id,
      newValue: updated,
      context,
    });
    return updated;
  });
}

export async function listReports(actor: Actor) {
  if (!["ADMIN", "MANAGER", "TEACHER"].includes(actor.role)) {
    throw new AppError("FORBIDDEN");
  }
  return prisma.report.findMany({
    where:
      actor.role === "ADMIN" || actor.role === "MANAGER"
        ? {}
        : { requestedById: actor.id },
    select: {
      id: true,
      type: true,
      status: true,
      errorMessage: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
      fileAssetId: true,
      requestedBy: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
