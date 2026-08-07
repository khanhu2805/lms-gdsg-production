import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { UserRole } from "@/generated/prisma/enums";
import type { RequestContext } from "@/lib/security/request-context";

type AuditClient = Prisma.TransactionClient;

function toInputJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(
    JSON.stringify(value, (_key, nestedValue) => {
      if (typeof nestedValue === "bigint") return nestedValue.toString();
      if (
        nestedValue &&
        typeof nestedValue === "object" &&
        typeof nestedValue.toJSON === "function"
      ) {
        return nestedValue.toJSON();
      }
      return nestedValue;
    }),
  ) as Prisma.InputJsonValue;
}

export async function writeAuditLog(
  tx: AuditClient,
  input: {
    actorId?: string | null;
    actorRole: UserRole;
    action: string;
    entityType: string;
    entityId: string;
    oldValue?: unknown;
    newValue?: unknown;
    reason?: string;
    context?: RequestContext;
  },
) {
  return tx.auditLog.create({
    data: {
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValue: toInputJson(input.oldValue),
      newValue: toInputJson(input.newValue),
      reason: input.reason,
      ipAddress: input.context?.ipAddress,
      userAgent: input.context?.userAgent,
    },
  });
}
