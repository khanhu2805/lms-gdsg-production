import { requireRoles } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { userMutationSchema } from "@/modules/users/user.schemas";
import {
  getManagedUserDetail,
  mutateManagedUser,
} from "@/modules/users/user.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireRoles(["ADMIN", "MANAGER"], request.headers);
    const { userId } = await params;
    return apiSuccess(await getManagedUserDetail(actor, userId));
  } catch (error) {
    return apiError(error, context.requestId);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireRoles(["ADMIN", "MANAGER"], request.headers);
    const { userId } = await params;
    const input = userMutationSchema.parse(await parseJsonBody(request));
    const user = await mutateManagedUser(actor, userId, input, context);
    return apiSuccess(user);
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
