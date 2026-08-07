import { ZodError } from "zod";

import { logger } from "@/lib/logger";

import { AppError } from "./app-error";

type SuccessEnvelope<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

type ErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function apiSuccess<T>(
  data: T,
  options?: { status?: number; meta?: Record<string, unknown> },
) {
  const body: SuccessEnvelope<T> = {
    success: true,
    data,
    ...(options?.meta ? { meta: options.meta } : {}),
  };
  return Response.json(body, { status: options?.status ?? 200 });
}

export function apiError(error: unknown, requestId?: string) {
  if (error instanceof ZodError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu nhập vào chưa hợp lệ.",
        details: error.flatten(),
      },
    };
    return Response.json(body, { status: 422 });
  }

  if (error instanceof AppError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    };
    return Response.json(body, { status: error.status });
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    if (error.code === "P2002" || error.code === "P2034") {
      return Response.json(
        {
          success: false,
          error: {
            code: "CONFLICT",
            message: "Dữ liệu bị trùng với một bản ghi hiện có.",
          },
        } satisfies ErrorEnvelope,
        { status: 409 },
      );
    }
    if (error.code === "P2025") {
      return Response.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Không tìm thấy dữ liệu được yêu cầu.",
          },
        } satisfies ErrorEnvelope,
        { status: 404 },
      );
    }
    if (error.code === "P2003") {
      return Response.json(
        {
          success: false,
          error: {
            code: "CONFLICT",
            message: "Dữ liệu đang được tham chiếu và không thể thay đổi.",
          },
        } satisfies ErrorEnvelope,
        { status: 409 },
      );
    }
  }

  logger.error(
    {
      requestId,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : String(error),
    },
    "Unhandled API error",
  );

  const body: ErrorEnvelope = {
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
    },
  };
  return Response.json(body, { status: 500 });
}
