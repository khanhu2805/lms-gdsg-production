import { requireRoles } from "@/lib/auth/actor";
import { prisma } from "@/lib/database/client";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { createSettingSchema } from "@/modules/settings/setting.schemas";
import { createSystemSetting } from "@/modules/settings/setting.service";

export async function GET(request: Request) {
  const context = getRequestContext(request.headers);
  try {
    await requireRoles(["ADMIN"], request.headers);
    return apiSuccess(
      await prisma.systemSetting.findMany({ orderBy: { key: "asc" } }),
    );
  } catch (error) {
    return apiError(error, context.requestId);
  }
}

export async function POST(request: Request) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireRoles(["ADMIN"], request.headers);
    const input = createSettingSchema.parse(await parseJsonBody(request));
    return apiSuccess(await createSystemSetting(actor, input, context), {
      status: 201,
    });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
