import { z } from "zod";

import { requireActor } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { getRequestContext } from "@/lib/security/request-context";
import { listAuditLogs } from "@/modules/audit/audit.repository";

const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().trim().max(100).optional(),
});

export async function GET(request: Request) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const query = auditQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const { logs, total } = await listAuditLogs(actor, query);
    return apiSuccess(logs, {
      meta: {
        ...query,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
