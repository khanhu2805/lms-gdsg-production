import "server-only";

import { env } from "@/config/env";
import type { AttendanceSource } from "@/generated/prisma/enums";
import type { Actor } from "@/lib/auth/actor";
import { assertStaffClassAccess } from "@/lib/authorization/class-access";
import { canMarkAttendance } from "@/lib/authorization/permissions";
import { prisma } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import type { RequestContext } from "@/lib/security/request-context";
import { writeAuditLog } from "@/modules/audit/audit.service";
import { assertParentStudentLink } from "@/lib/authorization/class-access";

import {
  canJoinSession,
  determineJoinAttendanceStatus,
} from "./attendance-policy";
import type { markAttendanceSchema } from "./attendance.schemas";
import type { z } from "zod";

type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;

const manualSourceByRole: Partial<Record<Actor["role"], AttendanceSource>> = {
  ADMIN: "MANUAL_ADMIN",
  MANAGER: "MANUAL_MANAGER",
  TEACHER: "MANUAL_TEACHER",
  TEACHING_ASSISTANT: "MANUAL_ASSISTANT",
};

export async function registerStudentJoin(
  actor: Actor,
  sessionId: string,
  context?: RequestContext,
) {
  if (actor.role !== "STUDENT") throw new AppError("FORBIDDEN");
  const session = await prisma.classSession.findFirst({
    where: {
      id: sessionId,
      courseClass: {
        status: "ACTIVE",
        students: {
          some: {
            studentId: actor.id,
            status: "ACTIVE",
          },
        },
      },
    },
    select: {
      id: true,
      classId: true,
      startAt: true,
      endAt: true,
      status: true,
      meetingUrl: true,
    },
  });
  if (!session) throw new AppError("FORBIDDEN");

  const now = new Date();
  if (
    !canJoinSession({
      now,
      startAt: session.startAt,
      endAt: session.endAt,
      earlyMinutes: env.ATTENDANCE_EARLY_MINUTES,
      cancelled: session.status === "CANCELLED",
    })
  ) {
    throw new AppError(
      "CONFLICT",
      "Buổi học chưa mở, đã kết thúc hoặc đã bị hủy.",
    );
  }
  if (!session.meetingUrl) {
    throw new AppError(
      "CONFLICT",
      "Buổi học chưa được cấu hình đường dẫn tham gia.",
    );
  }

  const joinStatus = determineJoinAttendanceStatus({
    sessionStartAt: session.startAt,
    joinedAt: now,
    earlyMinutes: env.ATTENDANCE_EARLY_MINUTES,
    lateAfterMinutes: env.ATTENDANCE_LATE_AFTER_MINUTES,
  });

  const attendance = await prisma.$transaction(async (tx) => {
    const existing = await tx.attendance.findUnique({
      where: {
        classSessionId_studentId: {
          classSessionId: sessionId,
          studentId: actor.id,
        },
      },
    });

    const nextStatus =
      !existing || existing.status === "PENDING" ? joinStatus : existing.status;
    const saved = await tx.attendance.upsert({
      where: {
        classSessionId_studentId: {
          classSessionId: sessionId,
          studentId: actor.id,
        },
      },
      create: {
        classSessionId: sessionId,
        studentId: actor.id,
        status: nextStatus,
        source: "AUTO_JOIN_CLICK",
        firstJoinClickedAt: now,
        lastJoinClickedAt: now,
        markedAt: now,
      },
      update: {
        status: nextStatus,
        source: existing?.status === "PENDING" ? "AUTO_JOIN_CLICK" : undefined,
        firstJoinClickedAt: existing?.firstJoinClickedAt ?? now,
        lastJoinClickedAt: now,
        markedAt: now,
      },
    });

    if (!existing || existing.status !== saved.status) {
      await tx.attendanceAudit.create({
        data: {
          attendanceId: saved.id,
          actorId: actor.id,
          actorRole: actor.role,
          oldStatus: existing?.status,
          newStatus: saved.status,
          oldNote: existing?.note,
          newNote: saved.note,
          reason: "Học sinh nhấn nút Vào lớp.",
        },
      });
    }
    await writeAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "STUDENT_SESSION_JOIN_CLICKED",
      entityType: "Attendance",
      entityId: saved.id,
      oldValue: existing,
      newValue: saved,
      context,
    });
    return saved;
  });

  return {
    attendance: {
      id: attendance.id,
      status: attendance.status,
      firstJoinClickedAt: attendance.firstJoinClickedAt,
    },
    meetingUrl: session.meetingUrl,
  };
}

export async function markAttendance(
  actor: Actor,
  sessionId: string,
  input: MarkAttendanceInput,
  context?: RequestContext,
) {
  if (!canMarkAttendance(actor.role)) throw new AppError("FORBIDDEN");
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: { classId: true },
  });
  if (!session) throw new AppError("NOT_FOUND");
  await assertStaffClassAccess(actor, session.classId);

  const membership = await prisma.classStudent.findFirst({
    where: {
      classId: session.classId,
      studentId: input.studentId,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (!membership) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Học sinh không thuộc lớp của buổi học.",
    );
  }

  const source = manualSourceByRole[actor.role];
  if (!source) throw new AppError("FORBIDDEN");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.attendance.findUnique({
      where: {
        classSessionId_studentId: {
          classSessionId: sessionId,
          studentId: input.studentId,
        },
      },
    });
    const now = new Date();
    const saved = await tx.attendance.upsert({
      where: {
        classSessionId_studentId: {
          classSessionId: sessionId,
          studentId: input.studentId,
        },
      },
      create: {
        classSessionId: sessionId,
        studentId: input.studentId,
        status: input.status,
        source,
        markedById: actor.id,
        markedAt: now,
        note: input.note,
      },
      update: {
        status: input.status,
        source,
        markedById: actor.id,
        markedAt: now,
        note: input.note,
      },
    });
    await tx.attendanceAudit.create({
      data: {
        attendanceId: saved.id,
        actorId: actor.id,
        actorRole: actor.role,
        oldStatus: existing?.status,
        newStatus: saved.status,
        oldNote: existing?.note,
        newNote: saved.note,
        reason: input.reason,
      },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "ATTENDANCE_MARKED",
      entityType: "Attendance",
      entityId: saved.id,
      oldValue: existing,
      newValue: saved,
      reason: input.reason,
      context,
    });
    return saved;
  });
}

export async function finalizeAttendanceForSession(sessionId: string) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.classSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        classId: true,
        endAt: true,
        status: true,
      },
    });
    if (!session) throw new AppError("NOT_FOUND");
    if (session.status === "CANCELLED" || session.endAt > new Date()) {
      throw new AppError("CONFLICT", "Buổi học chưa kết thúc hoặc đã bị hủy.");
    }

    const missingStudents = await tx.classStudent.findMany({
      where: {
        classId: session.classId,
        status: "ACTIVE",
        student: {
          attendanceRecords: {
            none: { classSessionId: sessionId },
          },
        },
      },
      select: { studentId: true },
    });

    for (const membership of missingStudents) {
      const attendance = await tx.attendance.create({
        data: {
          classSessionId: sessionId,
          studentId: membership.studentId,
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
          reason: "Hệ thống hoàn tất điểm danh sau buổi học.",
        },
      });
    }

    await tx.classSession.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
        attendanceOpen: false,
        attendanceClosedAt: new Date(),
      },
    });
    return { finalized: missingStudents.length };
  });
}

export async function listSessionAttendance(
  actor: Actor,
  sessionId: string,
  requestedStudentId?: string,
) {
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: { id: true, classId: true },
  });
  if (!session) throw new AppError("NOT_FOUND");

  if (
    ["ADMIN", "MANAGER", "TEACHER", "TEACHING_ASSISTANT"].includes(actor.role)
  ) {
    await assertStaffClassAccess(actor, session.classId);
    return prisma.attendance.findMany({
      where: { classSessionId: sessionId },
      select: {
        id: true,
        studentId: true,
        status: true,
        source: true,
        firstJoinClickedAt: true,
        lastJoinClickedAt: true,
        markedAt: true,
        note: true,
        student: {
          select: {
            name: true,
            profile: { select: { studentCode: true } },
          },
        },
      },
      orderBy: { student: { name: "asc" } },
    });
  }

  const studentId = actor.role === "STUDENT" ? actor.id : requestedStudentId;
  if (!studentId) throw new AppError("VALIDATION_ERROR");
  if (actor.role === "PARENT") {
    await assertParentStudentLink(actor.id, studentId);
  } else if (actor.role !== "STUDENT") {
    throw new AppError("FORBIDDEN");
  }

  const membership = await prisma.classStudent.findFirst({
    where: { classId: session.classId, studentId },
    select: { id: true },
  });
  if (!membership) throw new AppError("FORBIDDEN");

  return prisma.attendance.findMany({
    where: { classSessionId: sessionId, studentId },
    select: {
      id: true,
      studentId: true,
      status: true,
      firstJoinClickedAt: true,
      markedAt: true,
      note: true,
    },
  });
}
