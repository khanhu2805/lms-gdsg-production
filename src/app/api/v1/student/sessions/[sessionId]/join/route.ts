import { requireActor } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { getRequestContext } from "@/lib/security/request-context";
import { registerStudentJoin } from "@/modules/attendance/attendance.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { sessionId } = await params;
    const result = await registerStudentJoin(actor, sessionId, context);
    return apiSuccess({
      attendance: result.attendance,
      joinPath: `/student/sessions/${sessionId}/join`,
    });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
