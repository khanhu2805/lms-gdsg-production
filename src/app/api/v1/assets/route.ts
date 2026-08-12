import { z } from "zod";

import { requireActor } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { AppError } from "@/lib/errors/app-error";
import { parseFormDataBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import {
  storeAsset,
  storeStreamingVideoAsset,
} from "@/lib/storage/asset.service";

const uploadCategorySchema = z.enum([
  "RECORDING",
  "DOCUMENT",
  "SUBMISSION",
  "IMAGE",
]);

function assertTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");

  // Cho phép request server-to-server hoặc client không gửi Origin.
  if (!origin) return;

  const requestOrigin = new URL(request.url).origin;

  const trustedOrigins = new Set([
    requestOrigin,
    process.env.NEXT_PUBLIC_APP_URL,
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ?? []),
  ]);

  const normalizedOrigin =
    origin.trim().replace(/\/$/, "");

  const allowed = [...trustedOrigins]
    .filter(
      (value): value is string =>
        Boolean(value),
    )
    .map((value) =>
      value.trim().replace(/\/$/, ""),
    )
    .includes(normalizedOrigin);

  if (!allowed) {
    throw new AppError(
      "FORBIDDEN",
      "Nguồn gửi yêu cầu không được phép.",
    );
  }
}

export async function POST(request: Request) {
  const context = getRequestContext(request.headers);
  try {
    assertTrustedOrigin(request);
    const actor = await requireActor(request.headers);
    if (
      ![
        "ADMIN",
        "MANAGER",
        "TEACHER",
        "TEACHING_ASSISTANT",
        "STUDENT",
      ].includes(actor.role)
    ) {
      throw new AppError("FORBIDDEN");
    }

    const contentType = request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    if (contentType !== "multipart/form-data") {
      if (
        !["ADMIN", "MANAGER", "TEACHER", "TEACHING_ASSISTANT"].includes(
          actor.role,
        )
      ) {
        throw new AppError("FORBIDDEN");
      }
      const originalName = request.headers.get("x-file-name")?.trim();
      if (!originalName || originalName.length > 255) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Header X-File-Name phải chứa tên video hợp lệ.",
        );
      }
      const contentEncoding = request.headers
        .get("content-encoding")
        ?.trim()
        .toLowerCase();
      if (contentEncoding && contentEncoding !== "identity") {
        throw new AppError(
          "VALIDATION_ERROR",
          "Video tải lên không được phép nén ở tầng HTTP.",
        );
      }

      const contentLengthHeader = request.headers.get("content-length");
      let declaredSize: number | undefined;
      if (contentLengthHeader !== null) {
        if (!/^\d+$/.test(contentLengthHeader)) {
          throw new AppError(
            "VALIDATION_ERROR",
            "Content-Length không hợp lệ.",
          );
        }
        declaredSize = Number(contentLengthHeader);
        if (!Number.isSafeInteger(declaredSize)) {
          throw new AppError(
            "VALIDATION_ERROR",
            "Content-Length không hợp lệ.",
          );
        }
      }

      return apiSuccess(
        await storeStreamingVideoAsset(
          actor,
          {
            body: request.body,
            originalName,
            claimedMimeType: contentType,
            declaredSize,
          },
          context,
        ),
        { status: 201 },
      );
    }

    const formData = await parseFormDataBody(request);
    const category = uploadCategorySchema.parse(formData.get("category"));
    if (actor.role === "STUDENT" && category !== "SUBMISSION") {
      throw new AppError("FORBIDDEN");
    }
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("VALIDATION_ERROR", "Vui lòng chọn file cần tải lên.");
    }
    return apiSuccess(await storeAsset(actor, { category, file }, context), {
      status: 201,
    });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
