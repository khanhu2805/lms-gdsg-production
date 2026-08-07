import "server-only";

import type { Actor } from "@/lib/auth/actor";
import { prisma } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";

export async function listAuditLogs(
  actor: Actor,
  input: { page: number; pageSize: number; action?: string },
) {
  if (!["ADMIN", "MANAGER"].includes(actor.role)) {
    throw new AppError("FORBIDDEN");
  }
  const where = {
    action: input.action
      ? { contains: input.action, mode: "insensitive" as const }
      : undefined,
    ...(actor.role === "MANAGER" ? { entityType: { not: "User" } } : {}),
  };
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        actorRole: true,
        action: true,
        entityType: true,
        entityId: true,
        reason: true,
        ipAddress: true,
        createdAt: true,
        actor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { logs, total };
}
