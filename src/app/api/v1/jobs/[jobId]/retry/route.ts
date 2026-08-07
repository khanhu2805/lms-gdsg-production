import { z } from "zod";

import { requireActor } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { retryJob } from "@/modules/jobs/job.service";

const retrySchema = z.object({
  reason: z.string().trim().min(3).max(1000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { jobId } = await params;
    const { reason } = retrySchema.parse(await parseJsonBody(request));
    return apiSuccess(await retryJob(actor, jobId, reason, context));
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
