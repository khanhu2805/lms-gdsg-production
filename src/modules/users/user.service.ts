import "server-only";

import type { Actor } from "@/lib/auth/actor";
import { canActOnUser, canCreateRole } from "@/lib/authorization/permissions";
import { prisma } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import type { RequestContext } from "@/lib/security/request-context";
import { writeAuditLog } from "@/modules/audit/audit.service";

import type { createUserSchema, userMutationSchema } from "./user.schemas";
import type { z } from "zod";

type CreateUserInput = z.infer<typeof createUserSchema>;
type UserMutationInput = z.infer<typeof userMutationSchema>;

export async function getManagedUserDetail(actor: Actor, targetId: string) {
  if (!["ADMIN", "MANAGER"].includes(actor.role)) {
    throw new AppError("FORBIDDEN");
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      name: true,
      image: true,
      role: true,
      status: true,
      lockedAt: true,
      deletedAt: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      profile: true,
      teacherMemberships: {
        where: { status: "ACTIVE" },
        select: {
          type: true,
          courseClass: {
            select: { id: true, code: true, name: true, status: true },
          },
        },
        orderBy: { assignedAt: "desc" },
      },
      assistantMemberships: {
        where: { status: "ACTIVE" },
        select: {
          courseClass: {
            select: { id: true, code: true, name: true, status: true },
          },
        },
        orderBy: { assignedAt: "desc" },
      },
      studentMemberships: {
        where: { status: "ACTIVE" },
        select: {
          joinedAt: true,
          courseClass: {
            select: { id: true, code: true, name: true, status: true },
          },
        },
        orderBy: { joinedAt: "desc" },
      },
      parentLinks: {
        where: { status: "ACTIVE" },
        select: {
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
        orderBy: { linkedAt: "desc" },
      },
      _count: { select: { sessions: true } },
    },
  });

  if (!target) throw new AppError("NOT_FOUND");
  if (actor.role === "MANAGER" && target.role === "ADMIN") {
    throw new AppError(
      "FORBIDDEN",
      "Quản lý không được xem hoặc tác động tới tài khoản quản trị viên.",
    );
  }

  return target;
}

export async function createManagedUser(
  actor: Actor,
  input: CreateUserInput,
  context?: RequestContext,
) {
  if (!canCreateRole(actor.role, input.role)) {
    throw new AppError("FORBIDDEN");
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw new AppError("CONFLICT", "Email này đã có trong hệ thống.");
    }

    const user = await tx.user.create({
      data: {
        email: input.email,
        emailVerified: true,
        name: input.name,
        role: input.role,
        status: "ACTIVE",
        profile: input.profile
          ? {
              create: input.profile,
            }
          : undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    await writeAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
      newValue: user,
      context,
    });

    return user;
  });
}

export async function mutateManagedUser(
  actor: Actor,
  targetId: string,
  input: UserMutationInput,
  context?: RequestContext,
) {
  return prisma.$transaction(
    async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: targetId },
        include: { profile: true },
      });
      if (!target) throw new AppError("NOT_FOUND");

      const actionForPermission =
        input.action === "CHANGE_ROLE" || input.action === "UPDATE"
          ? "UPDATE"
          : input.action === "UNLOCK"
            ? "LOCK"
            : input.action === "RESTORE"
              ? "RESTORE"
              : input.action;

      if (
        !canActOnUser(
          actor,
          target,
          actionForPermission,
          input.action === "CHANGE_ROLE" ? input.role : undefined,
        )
      ) {
        throw new AppError("FORBIDDEN");
      }

      if (
        target.role === "ADMIN" &&
        ["LOCK", "DELETE"].includes(input.action)
      ) {
        const activeAdmins = await tx.user.count({
          where: {
            role: "ADMIN",
            status: "ACTIVE",
            lockedAt: null,
            deletedAt: null,
          },
        });
        if (activeAdmins <= 1) {
          throw new AppError(
            "CONFLICT",
            "Không thể khóa hoặc xóa quản trị viên hoạt động cuối cùng.",
          );
        }
      }

      if (
        input.action === "CHANGE_ROLE" &&
        target.role === "ADMIN" &&
        input.role !== "ADMIN"
      ) {
        const activeAdmins = await tx.user.count({
          where: {
            role: "ADMIN",
            status: "ACTIVE",
            lockedAt: null,
            deletedAt: null,
          },
        });
        if (activeAdmins <= 1) {
          throw new AppError(
            "CONFLICT",
            "Hệ thống phải luôn có ít nhất một quản trị viên hoạt động.",
          );
        }
      }

      let data: Parameters<typeof tx.user.update>[0]["data"] = {};
      let revokeSessions = false;

      switch (input.action) {
        case "UPDATE":
          data = {
            name: input.name,
            image: input.image,
            profile: input.profile
              ? {
                  upsert: {
                    create: input.profile,
                    update: input.profile,
                  },
                }
              : undefined,
          };
          break;
        case "CHANGE_ROLE":
          data = { role: input.role };
          revokeSessions = true;
          break;
        case "LOCK":
          data = { status: "LOCKED", lockedAt: new Date() };
          revokeSessions = true;
          break;
        case "UNLOCK":
          data = { status: "ACTIVE", lockedAt: null };
          break;
        case "DELETE":
          data = {
            status: "INACTIVE",
            deletedAt: new Date(),
            lockedAt: null,
          };
          revokeSessions = true;
          break;
        case "RESTORE":
          data = {
            status: "ACTIVE",
            deletedAt: null,
            lockedAt: null,
          };
          break;
        case "REVOKE_SESSIONS":
          revokeSessions = true;
          break;
      }

      const updated =
        input.action === "REVOKE_SESSIONS"
          ? target
          : await tx.user.update({
              where: { id: targetId },
              data,
              include: { profile: true },
            });

      if (revokeSessions) {
        await tx.session.deleteMany({ where: { userId: targetId } });
      }

      await writeAuditLog(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action: `USER_${input.action}`,
        entityType: "User",
        entityId: targetId,
        oldValue: target,
        newValue: updated,
        reason: input.reason,
        context,
      });

      return {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        status: updated.status,
        lockedAt: updated.lockedAt,
        deletedAt: updated.deletedAt,
      };
    },
    { isolationLevel: "Serializable" },
  );
}
