import { AppError } from "./app-error";

export async function parseJsonBody(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new AppError("BAD_REQUEST", "Nội dung JSON không hợp lệ.");
  }
}

export async function parseFormDataBody(request: Request) {
  try {
    return await request.formData();
  } catch {
    throw new AppError("BAD_REQUEST", "Dữ liệu tải lên không hợp lệ.");
  }
}
