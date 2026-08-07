import { requireActor } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { contentActionSchema } from "@/modules/contents/content.schemas";
import { executeContentWorkflow } from "@/modules/contents/content.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { contentId } = await params;
    const input = contentActionSchema.parse(await parseJsonBody(request));
    return apiSuccess(
      await executeContentWorkflow(actor, contentId, input, context),
    );
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
