import { requireRoles } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { addStudentSchema } from "@/modules/classes/class.schemas";
import { addStudentToClass } from "@/modules/classes/class.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireRoles(["ADMIN", "MANAGER"], request.headers);
    const { classId } = await params;
    const input = addStudentSchema.parse(await parseJsonBody(request));
    const result = await addStudentToClass(actor, classId, input, context);
    return apiSuccess(result, { status: 201 });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
