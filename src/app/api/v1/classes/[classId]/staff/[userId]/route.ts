import { z } from "zod";

import { requireRoles } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { removeClassMemberSchema } from "@/modules/classes/class.schemas";
import { removeClassStaff } from "@/modules/classes/class.service";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ classId: string; userId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireRoles(["ADMIN", "MANAGER"], request.headers);
    const { classId, userId } = await params;
    const role = z
      .enum(["TEACHER", "TEACHING_ASSISTANT"])
      .parse(new URL(request.url).searchParams.get("role"));
    const input = removeClassMemberSchema.parse(await parseJsonBody(request));
    return apiSuccess(
      await removeClassStaff(actor, classId, userId, role, input, context),
    );
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
