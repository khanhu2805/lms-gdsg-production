import { requireActor } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { getRequestContext } from "@/lib/security/request-context";
import { getStudentAssignment } from "@/modules/assignments/assignment.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { assignmentId } = await params;
    return apiSuccess(await getStudentAssignment(actor, assignmentId));
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
