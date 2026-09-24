import { readFile } from "node:fs/promises";

import { requireActor } from "@/lib/auth/actor";

import { assertClassAccess } from "@/lib/authorization/class-access";

import { prisma } from "@/lib/database/client";

import { apiError, apiSuccess } from "@/lib/errors/api-response";

import { AppError } from "@/lib/errors/app-error";

import { getRequestContext } from "@/lib/security/request-context";

import { resolveProtectedStoragePath } from "@/lib/storage/file-policy";

type Manifest = {
  version: 1;
  pageCount: number;
  files: string[];
};

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
      select: {
        id: true,
        previewStatus: true,

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

    if (
      (actor.role === "STUDENT" || actor.role === "PARENT") &&
      material.content.publicationStatus !== "PUBLISHED"
    ) {
      throw new AppError("FORBIDDEN");
    }

    if (material.previewStatus !== "READY") {
      throw new AppError("CONFLICT", "Tài liệu chưa sẵn sàng.");
    }

    const manifestPath = resolveProtectedStoragePath(
      `documents/previews/pages/${material.id}/manifest.json`,
    );

    const raw = await readFile(manifestPath, "utf8");

    const manifest = JSON.parse(raw) as Manifest;

    return apiSuccess({
      pageCount: manifest.pageCount,

      pages: manifest.files.map((_, index) => ({
        page: index + 1,

        url: `/api/v1/materials/${material.id}/pages/${index + 1}`,
      })),
    });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
