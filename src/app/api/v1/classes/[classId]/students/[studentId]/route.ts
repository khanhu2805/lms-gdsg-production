import { requireRoles } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { removeClassMemberSchema } from "@/modules/classes/class.schemas";
import { removeStudentFromClass } from "@/modules/classes/class.service";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ classId: string; studentId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireRoles(["ADMIN", "MANAGER"], request.headers);
    const { classId, studentId } = await params;
    const input = removeClassMemberSchema.parse(await parseJsonBody(request));
    return apiSuccess(
      await removeStudentFromClass(actor, classId, studentId, input, context),
    );
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
