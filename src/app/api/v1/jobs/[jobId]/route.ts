import { requireRoles } from "@/lib/auth/actor";
import { prisma } from "@/lib/database/client";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { AppError } from "@/lib/errors/app-error";
import { getRequestContext } from "@/lib/security/request-context";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    await requireRoles(["ADMIN", "MANAGER"], request.headers);
    const { jobId } = await params;
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        reports: {
          select: { id: true, type: true, status: true, createdAt: true },
        },
      },
    });
    if (!job) throw new AppError("NOT_FOUND");
    return apiSuccess(job);
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
