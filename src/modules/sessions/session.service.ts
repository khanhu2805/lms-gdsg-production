import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/actor";
import {
  assertClassAccess,
  assertStaffClassAccess,
} from "@/lib/authorization/class-access";
import { canManageClassSession } from "@/lib/authorization/permissions";
import { prisma } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import type { RequestContext } from "@/lib/security/request-context";
import { writeAuditLog } from "@/modules/audit/audit.service";
import { purgeContent } from "@/modules/contents/content.service";

import type {
  createClassSessionSchema,
  sessionOperationSchema,
  updateClassSessionSchema,
} from "./session.schemas";
import type { z } from "zod";

type CreateSessionInput = z.infer<typeof createClassSessionSchema>;
type UpdateSessionInput = z.infer<typeof updateClassSessionSchema>;
type SessionOperationInput = z.infer<typeof sessionOperationSchema>;

function assertSessionManager(actor: Actor) {
  if (!canManageClassSession(actor.role)) {
    throw new AppError("FORBIDDEN");
  }
}

async function assertNoSessionConflict(input: {
  tx: Prisma.TransactionClient;
  classId: string;
  startAt: Date;
  endAt: Date;
  room?: string | null;
  excludeId?: string;
}) {
  const conflict = await input.tx.classSession.findFirst({
    where: {
      id: input.excludeId ? { not: input.excludeId } : undefined,
      status: { not: "CANCELLED" },
      startAt: { lt: input.endAt },
      endAt: { gt: input.startAt },
      OR: [
        { classId: input.classId },
        ...(input.room ? [{ room: input.room }] : []),
      ],
    },
    select: { id: true, title: true, startAt: true, endAt: true },
  });
  if (conflict) {
    throw new AppError(
      "CONFLICT",
      "Thời gian buổi học bị trùng với một buổi học khác.",
      conflict,
    );
  }
}

async function lockSessionResources(
  tx: Prisma.TransactionClient,
  classId: string,
  room?: string | null,
) {
  const keys = [`class:${classId}`, ...(room ? [`room:${room.trim()}`] : [])]
    .filter(Boolean)
    .sort();
  for (const key of keys) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }
}

export async function createClassSession(
  actor: Actor,
  input: CreateSessionInput,
  context?: RequestContext,
) {
  assertSessionManager(actor);
  const courseClass = await prisma.courseClass.findUnique({
    where: { id: input.classId },
    select: { id: true, status: true },
  });
  if (!courseClass) throw new AppError("NOT_FOUND");
  if (courseClass.status !== "ACTIVE") {
    throw new AppError(
      "CONFLICT",
      "Chỉ có thể tạo buổi học cho lớp đang hoạt động.",
    );
  }
  return prisma.$transaction(
    async (tx) => {
      await lockSessionResources(tx, input.classId, input.room);
      await assertNoSessionConflict({ tx, ...input });
      const session = await tx.classSession.create({
        data: {
          ...input,
          createdById: actor.id,
        },
      });
      await writeAuditLog(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action: "CLASS_SESSION_CREATED",
        entityType: "ClassSession",
        entityId: session.id,
        newValue: session,
        context,
      });
      return session;
    },
    { isolationLevel: "Serializable" },
  );
}

export async function updateClassSession(
  actor: Actor,
  sessionId: string,
  input: UpdateSessionInput,
  context?: RequestContext,
) {
  assertSessionManager(actor);
  return prisma.$transaction(
    async (tx) => {
      const current = await tx.classSession.findUnique({
        where: { id: sessionId },
      });
      if (!current) throw new AppError("NOT_FOUND");
      if (current.status === "CANCELLED") {
        throw new AppError("CONFLICT", "Không thể sửa buổi học đã hủy.");
      }
      const startAt = input.startAt ?? current.startAt;
      const endAt = input.endAt ?? current.endAt;
      const room = input.room === undefined ? current.room : input.room;
      if (startAt >= endAt) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Giờ kết thúc phải sau giờ bắt đầu.",
        );
      }
      await lockSessionResources(tx, current.classId, room);
      await assertNoSessionConflict({
        tx,
        classId: current.classId,
        startAt,
        endAt,
        room,
        excludeId: sessionId,
      });

      const updated = await tx.classSession.update({
        where: { id: sessionId },
        data: {
          title: input.title,
          description: input.description,
          plannedContent: input.plannedContent,
          startAt: input.startAt,
          endAt: input.endAt,
          mode: input.mode,
          room: input.room,
          meetingUrl: input.meetingUrl,
        },
      });
      await writeAuditLog(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action: "CLASS_SESSION_UPDATED",
        entityType: "ClassSession",
        entityId: sessionId,
        oldValue: current,
        newValue: updated,
        reason: input.reason,
        context,
      });
      return updated;
    },
    { isolationLevel: "Serializable" },
  );
}

export async function operateClassSession(
  actor: Actor,
  sessionId: string,
  input: SessionOperationInput,
  context?: RequestContext,
) {
  assertSessionManager(actor);

  return prisma.$transaction(async (tx) => {
    const current = await tx.classSession.findUnique({
      where: { id: sessionId },
    });
    if (!current) throw new AppError("NOT_FOUND");

    const now = new Date();
    const updated = await tx.classSession.update({
      where: { id: sessionId },
      data:
        input.action === "CANCEL"
          ? {
              status: "CANCELLED",
              cancellationReason: input.reason,
              attendanceOpen: false,
              attendanceClosedAt: now,
            }
          : input.action === "OPEN_ATTENDANCE"
            ? {
                attendanceOpen: true,
                attendanceOpenedAt: now,
                attendanceClosedAt: null,
              }
            : {
                attendanceOpen: false,
                attendanceClosedAt: now,
              },
    });

    await writeAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: `CLASS_SESSION_${input.action}`,
      entityType: "ClassSession",
      entityId: sessionId,
      oldValue: current,
      newValue: updated,
      reason: input.reason,
      context,
    });
    return updated;
  });
}

export async function listAccessibleSessions(actor: Actor, classId: string) {
  await assertClassAccess(actor, classId);
  return prisma.classSession.findMany({
    where: { classId },
    select: {
      id: true,
      sessionNumber: true,
      title: true,
      description: true,
      plannedContent: true,
      startAt: true,
      endAt: true,
      mode: true,
      room: true,
      status: true,
      attendanceOpen: true,
      meetingUrl: [
        "ADMIN",
        "MANAGER",
        "TEACHER",
        "TEACHING_ASSISTANT",
      ].includes(actor.role),
    },
    orderBy: { sessionNumber: "asc" },
  });
}

export async function getAccessibleSessionDetail(
  actor: Actor,
  sessionId: string,
) {
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      classId: true,
      sessionNumber: true,
      title: true,
      description: true,
      plannedContent: true,
      startAt: true,
      endAt: true,
      mode: true,
      room: true,
      meetingUrl: true,
      status: true,
      cancellationReason: true,
      attendanceOpen: true,
      attendanceOpenedAt: true,
      attendanceClosedAt: true,
      createdAt: true,
      updatedAt: true,
      courseClass: {
        select: { id: true, code: true, name: true, status: true },
      },
      _count: { select: { contents: true, attendance: true } },
    },
  });
  if (!session) throw new AppError("NOT_FOUND");
  await assertClassAccess(actor, session.classId);

  const canSeeMeetingUrl = [
    "ADMIN",
    "MANAGER",
    "TEACHER",
    "TEACHING_ASSISTANT",
  ].includes(actor.role);

  return {
    ...session,
    meetingUrl: canSeeMeetingUrl ? session.meetingUrl : null,
  };
}

export async function getStaffSession(actor: Actor, sessionId: string) {
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: { id: true, classId: true },
  });
  if (!session) throw new AppError("NOT_FOUND");
  await assertStaffClassAccess(actor, session.classId);
  return session;
}

export async function purgeClassSession(
  actor: Actor,
  sessionId: string,
  reason: string,
  context?: RequestContext,
) {
  if (actor.role !== "ADMIN") {
    throw new AppError(
      "FORBIDDEN",
      "Chỉ quản trị viên được phép xóa vĩnh viễn buổi học.",
    );
  }

  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      classId: true,
      sessionNumber: true,
      title: true,
      createdAt: true,
    },
  });

  if (!session) {
    throw new AppError("NOT_FOUND");
  }

  /*
   * purgeContent không cho xóa version cũ nếu còn nextVersion,
   * nên xóa version mới nhất trước.
   */
  const contents = await prisma.content.findMany({
    where: {
      classSessionId: sessionId,
    },
    select: {
      id: true,
      version: true,
      createdAt: true,
    },
    orderBy: [
      { version: "desc" },
      { createdAt: "desc" },
    ],
  });

  for (const content of contents) {
    await purgeContent(
      actor,
      content.id,
      `Xóa cùng buổi học: ${reason}`,
      context,
    );
  }

  return prisma.$transaction(
    async (tx) => {
      /*
       * AttendanceAudit dùng Restrict → phải xóa trước Attendance.
       */
      await tx.attendanceAudit.deleteMany({
        where: {
          attendance: {
            classSessionId: sessionId,
          },
        },
      });

      await tx.attendance.deleteMany({
        where: {
          classSessionId: sessionId,
        },
      });

      await writeAuditLog(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action: "CLASS_SESSION_PERMANENTLY_DELETED",
        entityType: "ClassSession",
        entityId: session.id,
        oldValue: session,
        reason,
        context,
      });

      await tx.classSession.delete({
        where: {
          id: sessionId,
        },
      });

      return {
        id: sessionId,
        deleted: true,
      };
    },
    {
      isolationLevel: "Serializable",
    },
  );
}
