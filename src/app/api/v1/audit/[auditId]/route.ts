import { requireRoles } from "@/lib/auth/actor";
import { prisma } from "@/lib/database/client";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { AppError } from "@/lib/errors/app-error";
import { getRequestContext } from "@/lib/security/request-context";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ auditId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    await requireRoles(["ADMIN", "MANAGER"], request.headers);
    const { auditId } = await params;
    const log = await prisma.auditLog.findUnique({
      where: { id: auditId },
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    if (!log) throw new AppError("NOT_FOUND");
    return apiSuccess(log);
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
