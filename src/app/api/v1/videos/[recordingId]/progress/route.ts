import { z } from "zod";

import { requireActor } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { updateVideoProgress } from "@/modules/recordings/recording.service";

const progressSchema = z.object({
  viewSessionId: z.uuid(),
  currentTimeSeconds: z.number().min(0),
  durationSeconds: z.number().positive(),
  watchedDeltaSeconds: z.number().min(0),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ recordingId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { recordingId } = await params;
    const input = progressSchema.parse(await parseJsonBody(request));
    return apiSuccess(
      await updateVideoProgress(actor, recordingId, input, context),
    );
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
