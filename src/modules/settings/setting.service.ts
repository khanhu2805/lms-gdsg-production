import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/actor";
import { prisma } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import type { RequestContext } from "@/lib/security/request-context";
import { writeAuditLog } from "@/modules/audit/audit.service";

import type {
  createSettingSchema,
  updateSettingSchema,
} from "./setting.schemas";
import type { z } from "zod";

type CreateSettingInput = z.infer<typeof createSettingSchema>;
type UpdateSettingInput = z.infer<typeof updateSettingSchema>;

function assertAdmin(actor: Actor) {
  if (actor.role !== "ADMIN") throw new AppError("FORBIDDEN");
}

function asJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function createSystemSetting(
  actor: Actor,
  input: CreateSettingInput,
  context?: RequestContext,
) {
  assertAdmin(actor);
  return prisma.$transaction(async (tx) => {
    const setting = await tx.systemSetting.create({
      data: {
        key: input.key,
        value: asJsonValue(input.value),
        description: input.description,
        updatedById: actor.id,
      },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "SYSTEM_SETTING_CREATED",
      entityType: "SystemSetting",
      entityId: setting.key,
      newValue: setting,
      reason: input.reason,
      context,
    });
    return setting;
  });
}

export async function updateSystemSetting(
  actor: Actor,
  key: string,
  input: UpdateSettingInput,
  context?: RequestContext,
) {
  assertAdmin(actor);
  return prisma.$transaction(async (tx) => {
    const current = await tx.systemSetting.findUnique({ where: { key } });
    if (!current) throw new AppError("NOT_FOUND");
    const setting = await tx.systemSetting.update({
      where: { key },
      data: {
        value: asJsonValue(input.value),
        description: input.description,
        updatedById: actor.id,
      },
    });
    await writeAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "SYSTEM_SETTING_UPDATED",
      entityType: "SystemSetting",
      entityId: key,
      oldValue: current,
      newValue: setting,
      reason: input.reason,
      context,
    });
    return setting;
  });
}
