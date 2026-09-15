import "server-only";

import type { Actor } from "@/lib/auth/actor";
import { prisma } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import type { RequestContext } from "@/lib/security/request-context";
import { writeAuditLog } from "@/modules/audit/audit.service";

import type {
  subjectInputSchema,
  subjectUpdateSchema,
} from "./subject.schemas";
import type { z } from "zod";

type SubjectInput = z.infer<typeof subjectInputSchema>;
type SubjectUpdate = z.infer<typeof subjectUpdateSchema>;

function assertManager(actor: Actor) {
  if (!["ADMIN", "MANAGER"].includes(actor.role)) {
    throw new AppError("FORBIDDEN");
  }
}

export async function createSubject(
  actor: Actor,
  input: SubjectInput,
  context?: RequestContext,
) {
  assertManager(actor);
  return prisma.$transaction(async (tx) => {
    const subject = await tx.subject.create({ data: input });
    await writeAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "SUBJECT_CREATED",
      entityType: "Subject",
      entityId: subject.id,
      newValue: subject,
      context,
    });
    return subject;
  });
}

export async function updateSubject(
  actor: Actor,
  subjectId: string,
  input: SubjectUpdate,
  context?: RequestContext,
) {
  assertManager(actor);
  return prisma.$transaction(async (tx) => {
    const current = await tx.subject.findUnique({ where: { id: subjectId } });
    if (!current) throw new AppError("NOT_FOUND");
    const { reason, ...data } = input;
    const subject = await tx.subject.update({
      where: { id: subjectId },
      data,
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "SUBJECT_UPDATED",
      entityType: "Subject",
      entityId: subject.id,
      oldValue: current,
      newValue: subject,
      reason,
      context,
    });
    return subject;
  });
}

export async function purgeSubject(
  actor: Actor,
  subjectId: string,
  reason: string,
  context?: RequestContext,
) {
  if (actor.role !== "ADMIN") {
    throw new AppError(
      "FORBIDDEN",
      "Chỉ quản trị viên được phép xóa vĩnh viễn môn học.",
    );
  }

  return prisma.$transaction(
    async (tx) => {
      const subject = await tx.subject.findUnique({
        where: {
          id: subjectId,
        },
        include: {
          _count: {
            select: {
              classes: true,
            },
          },
        },
      });

      if (!subject) {
        throw new AppError("NOT_FOUND");
      }

      if (subject._count.classes > 0) {
        throw new AppError(
          "CONFLICT",
          `Môn học đang được ${subject._count.classes} lớp sử dụng. Hãy xóa hoặc chuyển các lớp sang môn khác trước.`,
        );
      }

      await writeAuditLog(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action: "SUBJECT_PERMANENTLY_DELETED",
        entityType: "Subject",
        entityId: subject.id,
        oldValue: {
          id: subject.id,
          code: subject.code,
          name: subject.name,
          description: subject.description,
          isActive: subject.isActive,
          createdAt: subject.createdAt,
        },
        reason,
        context,
      });

      await tx.subject.delete({
        where: {
          id: subjectId,
        },
      });

      return {
        id: subjectId,
        deleted: true,
      };
    },
    {
      isolationLevel: "Serializable",
    },
  );
}
