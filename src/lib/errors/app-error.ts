export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

const defaultMessages: Record<ErrorCode, string> = {
  BAD_REQUEST: "Yêu cầu không hợp lệ.",
  UNAUTHENTICATED: "Vui lòng đăng nhập để tiếp tục.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  NOT_FOUND: "Không tìm thấy dữ liệu được yêu cầu.",
  CONFLICT: "Dữ liệu đã thay đổi hoặc thao tác bị xung đột.",
  VALIDATION_ERROR: "Dữ liệu nhập vào chưa hợp lệ.",
  RATE_LIMITED: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
  INTERNAL_ERROR: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
};

const statusByCode: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(message ?? defaultMessages[code]);
    this.name = "AppError";
    this.code = code;
    this.status = statusByCode[code];
    this.details = details;
  }
}
