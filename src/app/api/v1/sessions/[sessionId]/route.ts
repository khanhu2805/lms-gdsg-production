import { requireActor, requireRoles } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import {
  sessionOperationSchema,
  updateClassSessionSchema,
} from "@/modules/sessions/session.schemas";
import {
  getAccessibleSessionDetail,
  operateClassSession,
  updateClassSession,
} from "@/modules/sessions/session.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { sessionId } = await params;
    return apiSuccess(await getAccessibleSessionDetail(actor, sessionId));
  } catch (error) {
    return apiError(error, context.requestId);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireRoles(["ADMIN", "MANAGER"], request.headers);
    const { sessionId } = await params;
    const body = await parseJsonBody(request);
    const operation = sessionOperationSchema.safeParse(body);
    const session = operation.success
      ? await operateClassSession(actor, sessionId, operation.data, context)
      : await updateClassSession(
          actor,
          sessionId,
          updateClassSessionSchema.parse(body),
          context,
        );
    return apiSuccess(session);
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
