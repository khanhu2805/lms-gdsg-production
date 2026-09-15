import { requireRoles } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { purgeCourseClass } from "@/modules/classes/class.service";
import { z } from "zod";

const schema = z.object({
  reason: z.string().trim().min(3).max(1000),
});

export async function DELETE(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      classId: string;
    }>;
  },
) {
  const context = getRequestContext(request.headers);

  try {
    const actor = await requireRoles(["ADMIN"], request.headers);

    const { classId } = await params;

    const { reason } = schema.parse(await parseJsonBody(request));

    return apiSuccess(await purgeCourseClass(actor, classId, reason, context));
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
