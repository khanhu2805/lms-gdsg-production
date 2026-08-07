import { requireRoles } from "@/lib/auth/actor";
import { prisma } from "@/lib/database/client";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { AppError } from "@/lib/errors/app-error";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import {
  settingKeySchema,
  updateSettingSchema,
} from "@/modules/settings/setting.schemas";
import { updateSystemSetting } from "@/modules/settings/setting.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    await requireRoles(["ADMIN"], request.headers);
    const { key: rawKey } = await params;
    const key = settingKeySchema.parse(decodeURIComponent(rawKey));
    const setting = await prisma.systemSetting.findUnique({ where: { key } });
    if (!setting) throw new AppError("NOT_FOUND");
    return apiSuccess(setting);
  } catch (error) {
    return apiError(error, context.requestId);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireRoles(["ADMIN"], request.headers);
    const { key: rawKey } = await params;
    const key = settingKeySchema.parse(decodeURIComponent(rawKey));
    const input = updateSettingSchema.parse(await parseJsonBody(request));
    return apiSuccess(await updateSystemSetting(actor, key, input, context));
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
