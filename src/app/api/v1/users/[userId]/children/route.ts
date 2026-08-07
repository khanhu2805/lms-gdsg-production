import { requireActor, requireRoles } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import {
  linkParentStudent,
  listParentStudents,
} from "@/modules/users/parent-link.service";
import { parentStudentLinkSchema } from "@/modules/users/user.schemas";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { userId } = await params;
    return apiSuccess(await listParentStudents(actor, userId));
  } catch (error) {
    return apiError(error, context.requestId);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireRoles(["ADMIN", "MANAGER"], request.headers);
    const { userId } = await params;
    const input = parentStudentLinkSchema.parse(await parseJsonBody(request));
    return apiSuccess(await linkParentStudent(actor, userId, input, context), {
      status: 201,
    });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
