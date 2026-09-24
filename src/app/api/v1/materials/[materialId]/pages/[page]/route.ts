import {
  readFile,
} from "node:fs/promises";

import path from "node:path";

import {
  requireActor,
} from "@/lib/auth/actor";

import {
  assertClassAccess,
} from "@/lib/authorization/class-access";

import {
  prisma,
} from "@/lib/database/client";

import {
  apiError,
} from "@/lib/errors/api-response";

import {
  AppError,
} from "@/lib/errors/app-error";

import {
  getRequestContext,
} from "@/lib/security/request-context";

import {
  nginxInternalPath,
} from "@/lib/storage/file-policy";

import {
  env,
} from "@/config/env";

type Manifest = {
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
      page: string;
    }>;
  },
) {
  const context =
    getRequestContext(
      request.headers,
    );

  try {
    const actor =
      await requireActor(
        request.headers,
      );

    const {
      materialId,
      page,
    } = await params;

    const pageNumber =
      Number(page);

    if (
      !Number.isInteger(
        pageNumber,
      ) ||
      pageNumber < 1
    ) {
      throw new AppError(
        "NOT_FOUND",
      );
    }

    const material =
      await prisma.material.findUnique({
        where: {
          id: materialId,
        },
        select: {
          id: true,

          previewStatus:
            true,

          content: {
            select: {
              classId:
                true,

              publicationStatus:
                true,
            },
          },
        },
      });

    if (!material) {
      throw new AppError(
        "NOT_FOUND",
      );
    }

    await assertClassAccess(
      actor,
      material.content.classId,
    );

    if (
      (actor.role ===
        "STUDENT" ||
        actor.role ===
        "PARENT") &&
      material.content
        .publicationStatus !==
        "PUBLISHED"
    ) {
      throw new AppError(
        "FORBIDDEN",
      );
    }

    const manifestPath =
      path.resolve(
        env.UPLOAD_ROOT,
        "documents",
        "previews",
        "pages",
        material.id,
        "manifest.json",
      );

    const manifest =
      JSON.parse(
        await readFile(
          manifestPath,
          "utf8",
        ),
      ) as Manifest;

    const fileName =
      manifest.files[
        pageNumber - 1
      ];

    if (!fileName) {
      throw new AppError(
        "NOT_FOUND",
      );
    }

    const storageKey =
      `documents/previews/pages/${material.id}/${fileName}`;

    return new Response(
      null,
      {
        status: 200,

        headers: {
          "X-Accel-Redirect":
            nginxInternalPath(
              storageKey,
            ),

          "Content-Type":
            "image/jpeg",

          "Content-Disposition":
            "inline",

          "Cache-Control":
            "private, no-store",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  } catch (error) {
    return apiError(
      error,
      context.requestId,
    );
  }
}