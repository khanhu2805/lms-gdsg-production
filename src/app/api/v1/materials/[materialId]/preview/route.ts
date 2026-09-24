import { requireActor } from "@/lib/auth/actor";

import { assertClassAccess } from "@/lib/authorization/class-access";

import { prisma } from "@/lib/database/client";

import { apiError } from "@/lib/errors/api-response";

import { AppError } from "@/lib/errors/app-error";

import { getRequestContext } from "@/lib/security/request-context";

import { nginxInternalPath } from "@/lib/storage/file-policy";

const OFFICE_PREVIEW_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      materialId: string;
    }>;
  },
) {
  const context = getRequestContext(request.headers);

  try {
    const actor = await requireActor(request.headers);

    const { materialId } = await params;

    const material = await prisma.material.findUnique({
      where: {
        id: materialId,
      },
      include: {
        content: {
          select: {
            classId: true,
            publicationStatus: true,
          },
        },
      },
    });

    if (!material) {
      throw new AppError("NOT_FOUND");
    }

    await assertClassAccess(actor, material.content.classId);

    /*
     * Learner không được nhận file PDF/raw preview.
     * Họ chỉ được dùng page-image viewer.
     */
    if (actor.role === "STUDENT" || actor.role === "PARENT") {
      throw new AppError(
        "FORBIDDEN",
        "Tài liệu chỉ được xem bằng trình xem bảo vệ.",
      );
    }

    if (material.previewStatus !== "READY" || !material.previewStorageKey) {
      throw new AppError("CONFLICT", "Bản xem tài liệu chưa sẵn sàng.");
    }

    const convertedToPdf = OFFICE_PREVIEW_MIME_TYPES.has(material.mimeType);

    const mimeType = convertedToPdf ? "application/pdf" : material.mimeType;

    const filename = convertedToPdf ? `${material.title}.pdf` : material.title;

    return new Response(null, {
      status: 200,
      headers: {
        "X-Accel-Redirect": nginxInternalPath(material.previewStorageKey),

        "Content-Type": mimeType,

        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(
          filename,
        )}`,

        "Cache-Control": "private, no-store",

        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
