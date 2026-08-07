import { requireRoles } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { unlinkParentStudent } from "@/modules/users/parent-link.service";
import { removeParentStudentLinkSchema } from "@/modules/users/user.schemas";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string; studentId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireRoles(["ADMIN", "MANAGER"], request.headers);
    const { userId, studentId } = await params;
    const input = removeParentStudentLinkSchema.parse(
      await parseJsonBody(request),
    );
    return apiSuccess(
      await unlinkParentStudent(actor, userId, studentId, input, context),
    );
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
