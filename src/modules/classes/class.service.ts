import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/actor";
import { canManageClass } from "@/lib/authorization/permissions";
import { prisma } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import type { RequestContext } from "@/lib/security/request-context";
import { writeAuditLog } from "@/modules/audit/audit.service";
import { purgeClassSession } from "@/modules/sessions/session.service";
import { generateClassCode } from "@/lib/codes/automatic-code";

import { calculateCapacity, canAddStudent } from "./capacity";
import type {
  addStudentSchema,
  assignClassStaffSchema,
  createClassSchema,
  removeClassMemberSchema,
  transferStudentSchema,
  updateClassSchema,
} from "./class.schemas";
import type { z } from "zod";

type CreateClassInput = z.infer<typeof createClassSchema>;
type UpdateClassInput = z.infer<typeof updateClassSchema>;
type AddStudentInput = z.infer<typeof addStudentSchema>;
type TransferStudentInput = z.infer<typeof transferStudentSchema>;
type AssignClassStaffInput = z.infer<typeof assignClassStaffSchema>;
type RemoveClassMemberInput = z.infer<typeof removeClassMemberSchema>;

function assertClassManager(actor: Actor) {
  if (!canManageClass(actor.role)) throw new AppError("FORBIDDEN");
}

async function managerHasCapacityOverride(
  tx: Prisma.TransactionClient,
  actor: Actor,
  classId: string,
) {
  if (actor.role !== "MANAGER") return false;
  const now = new Date();
  const grant = await tx.permissionGrant.findFirst({
    where: {
      userId: actor.id,
      permission: "OVERRIDE_CLASS_CAPACITY",
      revokedAt: null,
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        { OR: [{ scopeClassId: null }, { scopeClassId: classId }] },
      ],
    },
    select: { id: true },
  });
  return Boolean(grant);
}

async function lockClasses(tx: Prisma.TransactionClient, classIds: string[]) {
  const sortedIds = [...new Set(classIds)].sort();
  for (const classId of sortedIds) {
    await tx.$queryRaw`SELECT "id" FROM "classes" WHERE "id" = ${classId}::uuid FOR UPDATE`;
  }
}

export async function createCourseClass(
  actor: Actor,
  input: CreateClassInput,
  context?: RequestContext,
) {
  assertClassManager(actor);

  return prisma.$transaction(async (tx) => {
    const subject = await tx.subject.findFirst({
      where: {
        id: input.subjectId,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
      },
    });
    if (!subject) {
      throw new AppError("VALIDATION_ERROR", "Môn học không hợp lệ.");
    }
    const code = await generateClassCode(tx, subject.code, input.academicYear);
    const courseClass = await tx.courseClass.create({
      data: {
        ...input,
        code,
        createdById: actor.id,
      },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "CLASS_CREATED",
      entityType: "CourseClass",
      entityId: courseClass.id,
      newValue: courseClass,
      context,
    });
    return courseClass;
  });
}

export async function updateCourseClass(
  actor: Actor,
  classId: string,
  input: UpdateClassInput,
  context?: RequestContext,
) {
  assertClassManager(actor);

  return prisma.$transaction(
    async (tx) => {
      await lockClasses(tx, [classId]);
      const current = await tx.courseClass.findUnique({
        where: { id: classId },
      });
      if (!current) throw new AppError("NOT_FOUND");
      if (current.version !== input.expectedVersion) {
        throw new AppError(
          "CONFLICT",
          "Lớp đã được người khác cập nhật. Vui lòng tải lại dữ liệu.",
        );
      }

      if (input.subjectId && input.subjectId !== current.subjectId) {
        const subject = await tx.subject.findFirst({
          where: { id: input.subjectId, isActive: true },
          select: { id: true },
        });
        if (!subject) {
          throw new AppError("VALIDATION_ERROR", "Môn học không hợp lệ.");
        }
      }

      const activeStudents = await tx.classStudent.count({
        where: { classId, status: "ACTIVE" },
      });
      const nextCapacity = input.capacity ?? current.capacity;
      const nextStartDate = input.startDate ?? current.startDate;
      const nextEndDate = input.endDate ?? current.endDate;

      if (nextStartDate > nextEndDate) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.",
        );
      }

      if (nextCapacity < activeStudents && !input.confirmOverCapacity) {
        throw new AppError(
          "CONFLICT",
          "Sức chứa mới thấp hơn số học sinh hiện tại. Cần xác nhận lớp vượt sức chứa.",
          { activeStudents, requestedCapacity: nextCapacity },
        );
      }

      const updated = await tx.courseClass.update({
        where: { id: classId, version: input.expectedVersion },
        data: {
          name: input.name,
          subjectId: input.subjectId,
          academicYear: input.academicYear,
          startDate: input.startDate,
          endDate: input.endDate,
          mode: input.mode,
          capacity: input.capacity,
          status: input.status,
          description: input.description,
          internalNote: input.internalNote,
          overCapacitySince:
            nextCapacity < activeStudents
              ? (current.overCapacitySince ?? new Date())
              : null,
          version: { increment: 1 },
        },
      });

      await writeAuditLog(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action: "CLASS_UPDATED",
        entityType: "CourseClass",
        entityId: classId,
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

export async function addStudentToClass(
  actor: Actor,
  classId: string,
  input: AddStudentInput,
  context?: RequestContext,
) {
  assertClassManager(actor);

  return prisma.$transaction(
    async (tx) => {
      await lockClasses(tx, [classId]);
      const [courseClass, student, activeStudents] = await Promise.all([
        tx.courseClass.findUnique({ where: { id: classId } }),
        tx.user.findUnique({
          where: { id: input.studentId },
          select: {
            id: true,
            role: true,
            status: true,
            deletedAt: true,
          },
        }),
        tx.classStudent.count({
          where: { classId, status: "ACTIVE" },
        }),
      ]);

      if (!courseClass) throw new AppError("NOT_FOUND");
      if (
        !student ||
        student.role !== "STUDENT" ||
        student.status !== "ACTIVE" ||
        student.deletedAt
      ) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Tài khoản học sinh không hợp lệ hoặc không hoạt động.",
        );
      }

      const hasOverridePermission = await managerHasCapacityOverride(
        tx,
        actor,
        classId,
      );
      if (
        !canAddStudent({
          capacity: courseClass.capacity,
          activeStudents,
          actorRole: actor.role,
          hasOverridePermission,
          overrideReason: input.overrideReason,
        })
      ) {
        throw new AppError("CONFLICT", "Lớp đã đầy hoặc đang vượt sức chứa.");
      }

      const membership = await tx.classStudent.upsert({
        where: {
          classId_studentId: {
            classId,
            studentId: input.studentId,
          },
        },
        create: {
          classId,
          studentId: input.studentId,
          status: "ACTIVE",
        },
        update: {
          status: "ACTIVE",
          joinedAt: new Date(),
          leftAt: null,
        },
      });

      const nextSummary = calculateCapacity(
        courseClass.capacity,
        activeStudents + 1,
      );
      await tx.courseClass.update({
        where: { id: classId },
        data: {
          overCapacitySince:
            nextSummary.state === "OVER_CAPACITY"
              ? (courseClass.overCapacitySince ?? new Date())
              : null,
        },
      });

      await writeAuditLog(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action:
          nextSummary.state === "OVER_CAPACITY"
            ? "CLASS_STUDENT_ADDED_OVER_CAPACITY"
            : "CLASS_STUDENT_ADDED",
        entityType: "ClassStudent",
        entityId: membership.id,
        newValue: membership,
        reason: input.overrideReason,
        context,
      });
      return { membership, capacity: nextSummary };
    },
    { isolationLevel: "Serializable" },
  );
}

export async function transferStudent(
  actor: Actor,
  input: TransferStudentInput,
  context?: RequestContext,
) {
  assertClassManager(actor);
  if (input.sourceClassId === input.destinationClassId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Lớp nguồn và lớp đích phải khác nhau.",
    );
  }

  return prisma.$transaction(
    async (tx) => {
      await lockClasses(tx, [input.sourceClassId, input.destinationClassId]);
      const [sourceMembership, destinationClass, destinationCount] =
        await Promise.all([
          tx.classStudent.findUnique({
            where: {
              classId_studentId: {
                classId: input.sourceClassId,
                studentId: input.studentId,
              },
            },
          }),
          tx.courseClass.findUnique({
            where: { id: input.destinationClassId },
          }),
          tx.classStudent.count({
            where: {
              classId: input.destinationClassId,
              status: "ACTIVE",
            },
          }),
        ]);

      if (!sourceMembership || sourceMembership.status !== "ACTIVE") {
        throw new AppError(
          "CONFLICT",
          "Học sinh không còn hoạt động trong lớp nguồn.",
        );
      }
      if (!destinationClass) throw new AppError("NOT_FOUND");

      const hasOverridePermission = await managerHasCapacityOverride(
        tx,
        actor,
        destinationClass.id,
      );
      if (
        !canAddStudent({
          capacity: destinationClass.capacity,
          activeStudents: destinationCount,
          actorRole: actor.role,
          hasOverridePermission,
          overrideReason: input.overrideReason,
        })
      ) {
        throw new AppError("CONFLICT", "Lớp đích đã đầy.");
      }

      const now = new Date();
      const oldMembership = await tx.classStudent.update({
        where: { id: sourceMembership.id },
        data: { status: "TRANSFERRED", leftAt: now },
      });
      const newMembership = await tx.classStudent.upsert({
        where: {
          classId_studentId: {
            classId: input.destinationClassId,
            studentId: input.studentId,
          },
        },
        create: {
          classId: input.destinationClassId,
          studentId: input.studentId,
          status: "ACTIVE",
          joinedAt: now,
        },
        update: {
          status: "ACTIVE",
          joinedAt: now,
          leftAt: null,
        },
      });

      await writeAuditLog(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action: "CLASS_STUDENT_TRANSFERRED",
        entityType: "ClassStudent",
        entityId: newMembership.id,
        oldValue: oldMembership,
        newValue: newMembership,
        reason: input.reason,
        context,
      });
      return { source: oldMembership, destination: newMembership };
    },
    { isolationLevel: "Serializable" },
  );
}

export async function assignClassStaff(
  actor: Actor,
  classId: string,
  input: AssignClassStaffInput,
  context?: RequestContext,
) {
  assertClassManager(actor);
  return prisma.$transaction(
    async (tx) => {
      await lockClasses(tx, [classId]);
      const [courseClass, user] = await Promise.all([
        tx.courseClass.findUnique({
          where: { id: classId },
          select: { id: true },
        }),
        tx.user.findUnique({
          where: { id: input.userId },
          select: {
            id: true,
            role: true,
            status: true,
            lockedAt: true,
            deletedAt: true,
          },
        }),
      ]);
      if (!courseClass) throw new AppError("NOT_FOUND");
      const expectedRole =
        input.role === "TEACHER" ? "TEACHER" : "TEACHING_ASSISTANT";
      if (
        !user ||
        user.role !== expectedRole ||
        user.status !== "ACTIVE" ||
        user.lockedAt ||
        user.deletedAt
      ) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Nhân sự không đúng vai trò hoặc không hoạt động.",
        );
      }

      if (input.role === "TEACHER") {
        if (input.teacherType === "PRIMARY") {
          await tx.classTeacher.updateMany({
            where: {
              classId,
              type: "PRIMARY",
              status: "ACTIVE",
              teacherId: { not: input.userId },
            },
            data: { type: "SECONDARY" },
          });
        }
        const membership = await tx.classTeacher.upsert({
          where: {
            classId_teacherId: { classId, teacherId: input.userId },
          },
          create: {
            classId,
            teacherId: input.userId,
            type: input.teacherType,
          },
          update: {
            type: input.teacherType,
            status: "ACTIVE",
            assignedAt: new Date(),
            removedAt: null,
          },
        });
        await writeAuditLog(tx, {
          actorId: actor.id,
          actorRole: actor.role,
          action: "CLASS_TEACHER_ASSIGNED",
          entityType: "ClassTeacher",
          entityId: membership.id,
          newValue: membership,
          reason: input.reason,
          context,
        });
        return membership;
      }

      const membership = await tx.classAssistant.upsert({
        where: {
          classId_assistantId: {
            classId,
            assistantId: input.userId,
          },
        },
        create: { classId, assistantId: input.userId },
        update: {
          status: "ACTIVE",
          assignedAt: new Date(),
          removedAt: null,
        },
      });
      await writeAuditLog(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action: "CLASS_ASSISTANT_ASSIGNED",
        entityType: "ClassAssistant",
        entityId: membership.id,
        newValue: membership,
        reason: input.reason,
        context,
      });
      return membership;
    },
    { isolationLevel: "Serializable" },
  );
}

export async function removeClassStaff(
  actor: Actor,
  classId: string,
  userId: string,
  role: "TEACHER" | "TEACHING_ASSISTANT",
  input: RemoveClassMemberInput,
  context?: RequestContext,
) {
  assertClassManager(actor);
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const current =
      role === "TEACHER"
        ? await tx.classTeacher.findUnique({
            where: { classId_teacherId: { classId, teacherId: userId } },
          })
        : await tx.classAssistant.findUnique({
            where: {
              classId_assistantId: { classId, assistantId: userId },
            },
          });
    if (!current || current.status !== "ACTIVE") {
      throw new AppError("NOT_FOUND");
    }
    const updated =
      role === "TEACHER"
        ? await tx.classTeacher.update({
            where: { id: current.id },
            data: { status: "INACTIVE", removedAt: now },
          })
        : await tx.classAssistant.update({
            where: { id: current.id },
            data: { status: "INACTIVE", removedAt: now },
          });
    await writeAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: `CLASS_${role}_REMOVED`,
      entityType: role === "TEACHER" ? "ClassTeacher" : "ClassAssistant",
      entityId: current.id,
      oldValue: current,
      newValue: updated,
      reason: input.reason,
      context,
    });
    return updated;
  });
}

export async function removeStudentFromClass(
  actor: Actor,
  classId: string,
  studentId: string,
  input: RemoveClassMemberInput,
  context?: RequestContext,
) {
  assertClassManager(actor);
  return prisma.$transaction(
    async (tx) => {
      await lockClasses(tx, [classId]);
      const membership = await tx.classStudent.findUnique({
        where: { classId_studentId: { classId, studentId } },
      });
      if (!membership || membership.status !== "ACTIVE") {
        throw new AppError("NOT_FOUND");
      }
      const updated = await tx.classStudent.update({
        where: { id: membership.id },
        data: { status: "INACTIVE", leftAt: new Date() },
      });
      const [courseClass, activeStudents] = await Promise.all([
        tx.courseClass.findUnique({
          where: { id: classId },
          select: { capacity: true },
        }),
        tx.classStudent.count({
          where: { classId, status: "ACTIVE" },
        }),
      ]);
      if (courseClass && activeStudents <= courseClass.capacity) {
        await tx.courseClass.update({
          where: { id: classId },
          data: { overCapacitySince: null },
        });
      }
      await writeAuditLog(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action: "CLASS_STUDENT_REMOVED",
        entityType: "ClassStudent",
        entityId: membership.id,
        oldValue: membership,
        newValue: updated,
        reason: input.reason,
        context,
      });
      return updated;
    },
    { isolationLevel: "Serializable" },
  );
}

export async function purgeCourseClass(
  actor: Actor,
  classId: string,
  reason: string,
  context?: RequestContext,
) {
  if (actor.role !== "ADMIN") {
    throw new AppError(
      "FORBIDDEN",
      "Chỉ quản trị viên được phép xóa vĩnh viễn lớp học.",
    );
  }

  const courseClass = await prisma.courseClass.findUnique({
    where: {
      id: classId,
    },
    select: {
      id: true,
      code: true,
      name: true,
      subjectId: true,
      academicYear: true,
      status: true,
      createdAt: true,
    },
  });

  if (!courseClass) {
    throw new AppError("NOT_FOUND");
  }

  /*
   * Khóa lớp khỏi việc tạo buổi mới trong lúc purge.
   */
  await prisma.courseClass.update({
    where: {
      id: classId,
    },
    data: {
      status: "ARCHIVED",
    },
  });

  const sessions = await prisma.classSession.findMany({
    where: {
      classId,
    },
    select: {
      id: true,
    },
    orderBy: {
      sessionNumber: "desc",
    },
  });

  for (const session of sessions) {
    await purgeClassSession(
      actor,
      session.id,
      `Xóa cùng lớp ${courseClass.code}: ${reason}`,
      context,
    );
  }

  /*
   * Safety check:
   * mọi Content bắt buộc phải thuộc ClassSession.
   */
  const remainingContents = await prisma.content.count({
    where: {
      classId,
    },
  });

  if (remainingContents > 0) {
    throw new AppError(
      "CONFLICT",
      `Vẫn còn ${remainingContents} nội dung trong lớp. Không thể xóa lớp.`,
    );
  }

  return prisma.$transaction(
    async (tx) => {
      /*
       * PermissionGrant đang Restrict với CourseClass.
       */
      await tx.permissionGrant.deleteMany({
        where: {
          scopeClassId: classId,
        },
      });

      /*
       * Xóa membership, KHÔNG xóa User.
       */
      await tx.classTeacher.deleteMany({
        where: {
          classId,
        },
      });

      await tx.classAssistant.deleteMany({
        where: {
          classId,
        },
      });

      await tx.classStudent.deleteMany({
        where: {
          classId,
        },
      });

      await writeAuditLog(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action: "CLASS_PERMANENTLY_DELETED",
        entityType: "CourseClass",
        entityId: courseClass.id,
        oldValue: courseClass,
        reason,
        context,
      });

      await tx.courseClass.delete({
        where: {
          id: classId,
        },
      });

      return {
        id: classId,
        deleted: true,
      };
    },
    {
      isolationLevel: "Serializable",
    },
  );
}
