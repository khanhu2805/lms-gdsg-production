import { z } from "zod";

import { requireActor } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { getRequestContext } from "@/lib/security/request-context";
import { listJobs } from "@/modules/jobs/job.service";

export async function GET(request: Request) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const status = z
      .enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"])
      .optional()
      .parse(new URL(request.url).searchParams.get("status") ?? undefined);
    return apiSuccess(await listJobs(actor, status));
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
