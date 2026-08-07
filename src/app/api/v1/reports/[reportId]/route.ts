import { requireActor } from "@/lib/auth/actor";
import { prisma } from "@/lib/database/client";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { AppError } from "@/lib/errors/app-error";
import { getRequestContext } from "@/lib/security/request-context";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    if (!["ADMIN", "MANAGER", "TEACHER"].includes(actor.role)) {
      throw new AppError("FORBIDDEN");
    }
    const { reportId } = await params;
    const report = await prisma.report.findFirst({
      where: {
        id: reportId,
        ...(actor.role === "TEACHER" ? { requestedById: actor.id } : {}),
      },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        job: {
          select: {
            id: true,
            status: true,
            attempts: true,
            errorMessage: true,
          },
        },
        fileAsset: {
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
          },
        },
      },
    });
    if (!report) throw new AppError("NOT_FOUND");
    return apiSuccess({
      ...report,
      fileAsset: report.fileAsset
        ? {
            ...report.fileAsset,
            sizeBytes: report.fileAsset.sizeBytes.toString(),
            downloadUrl: `/api/v1/assets/${report.fileAsset.id}/download`,
          }
        : null,
    });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
