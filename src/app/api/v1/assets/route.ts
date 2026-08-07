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

export async function POST(request: Request) {
  const context = getRequestContext(request.headers);
  try {
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
