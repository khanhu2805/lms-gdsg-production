import "server-only";

import type { Actor } from "@/lib/auth/actor";
import { prisma } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import type { RequestContext } from "@/lib/security/request-context";
import { writeAuditLog } from "@/modules/audit/audit.service";

import type {
  parentStudentLinkSchema,
  removeParentStudentLinkSchema,
} from "./user.schemas";
import type { z } from "zod";

type LinkInput = z.infer<typeof parentStudentLinkSchema>;
type RemoveInput = z.infer<typeof removeParentStudentLinkSchema>;

function assertManager(actor: Actor) {
  if (!["ADMIN", "MANAGER"].includes(actor.role)) {
    throw new AppError("FORBIDDEN");
  }
}

export async function listParentStudents(actor: Actor, parentId: string) {
  if (
    actor.role !== "ADMIN" &&
    actor.role !== "MANAGER" &&
    !(actor.role === "PARENT" && actor.id === parentId)
  ) {
    throw new AppError("FORBIDDEN");
  }
  const parent = await prisma.user.findFirst({
    where: {
      id: parentId,
      role: "PARENT",
      status: "ACTIVE",
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!parent) throw new AppError("NOT_FOUND");
  return prisma.parentStudentLink.findMany({
    where: { parentId, status: "ACTIVE" },
    select: {
      id: true,
      isPrimary: true,
      linkedAt: true,
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          profile: { select: { studentCode: true } },
        },
      },
    },
    orderBy: { student: { name: "asc" } },
  });
}

export async function linkParentStudent(
  actor: Actor,
  parentId: string,
  input: LinkInput,
  context?: RequestContext,
) {
  assertManager(actor);
  return prisma.$transaction(
    async (tx) => {
      const [parent, student] = await Promise.all([
        tx.user.findFirst({
          where: {
            id: parentId,
            role: "PARENT",
            status: "ACTIVE",
            deletedAt: null,
          },
          select: { id: true },
        }),
        tx.user.findFirst({
          where: {
            id: input.studentId,
            role: "STUDENT",
            status: "ACTIVE",
            deletedAt: null,
          },
          select: { id: true },
        }),
      ]);
      if (!parent || !student) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Tài khoản phụ huynh hoặc học sinh không hợp lệ.",
        );
      }
      if (input.isPrimary) {
        await tx.parentStudentLink.updateMany({
          where: {
            studentId: input.studentId,
            isPrimary: true,
            status: "ACTIVE",
            parentId: { not: parentId },
          },
          data: { isPrimary: false },
        });
      }
      const link = await tx.parentStudentLink.upsert({
        where: {
          parentId_studentId: { parentId, studentId: input.studentId },
        },
        create: {
          parentId,
          studentId: input.studentId,
          isPrimary: input.isPrimary,
          reason: input.reason,
        },
        update: {
          isPrimary: input.isPrimary,
          status: "ACTIVE",
          reason: input.reason,
          linkedAt: new Date(),
          unlinkedAt: null,
        },
      });
      await writeAuditLog(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action: "PARENT_STUDENT_LINKED",
        entityType: "ParentStudentLink",
        entityId: link.id,
        newValue: link,
        reason: input.reason,
        context,
      });
      return link;
    },
    { isolationLevel: "Serializable" },
  );
}

export async function unlinkParentStudent(
  actor: Actor,
  parentId: string,
  studentId: string,
  input: RemoveInput,
  context?: RequestContext,
) {
  assertManager(actor);
  return prisma.$transaction(async (tx) => {
    const current = await tx.parentStudentLink.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
    });
    if (!current || current.status !== "ACTIVE") {
      throw new AppError("NOT_FOUND");
    }
    const updated = await tx.parentStudentLink.update({
      where: { id: current.id },
      data: {
        status: "INACTIVE",
        isPrimary: false,
        unlinkedAt: new Date(),
        reason: input.reason,
      },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "PARENT_STUDENT_UNLINKED",
      entityType: "ParentStudentLink",
      entityId: current.id,
      oldValue: current,
      newValue: updated,
      reason: input.reason,
      context,
    });
    return updated;
  });
}
