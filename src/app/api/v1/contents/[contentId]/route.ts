import { requireActor } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { updateContentSchema, purgeContentSchema } from "@/modules/contents/content.schemas";
import {
  getContentDetail,
  updateContent,
  purgeContent
} from "@/modules/contents/content.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { contentId } = await params;
    return apiSuccess(await getContentDetail(actor, contentId));
  } catch (error) {
    return apiError(error, context.requestId);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { contentId } = await params;
    const input = updateContentSchema.parse(await parseJsonBody(request));
    return apiSuccess(await updateContent(actor, contentId, input, context));
  } catch (error) {
    return apiError(error, context.requestId);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const context = getRequestContext(request.headers);

  try {
    const actor = await requireActor(request.headers);

    const { contentId } = await params;

    const input = purgeContentSchema.parse(
      await parseJsonBody(request),
    );

    return apiSuccess(
      await purgeContent(
        actor,
        contentId,
        input.reason,
        context,
      ),
    );
  } catch (error) {
    return apiError(error, context.requestId);
  }
}