import { requireRoles } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { transferStudentSchema } from "@/modules/classes/class.schemas";
import { transferStudent } from "@/modules/classes/class.service";

export async function POST(request: Request) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireRoles(["ADMIN", "MANAGER"], request.headers);
    const input = transferStudentSchema.parse(await parseJsonBody(request));
    return apiSuccess(await transferStudent(actor, input, context), {
      status: 201,
    });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
