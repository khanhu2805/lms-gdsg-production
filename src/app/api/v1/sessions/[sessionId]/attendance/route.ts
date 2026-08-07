import { requireActor } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { markAttendanceSchema } from "@/modules/attendance/attendance.schemas";
import {
  listSessionAttendance,
  markAttendance,
} from "@/modules/attendance/attendance.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { sessionId } = await params;
    const studentId =
      new URL(request.url).searchParams.get("studentId") ?? undefined;
    return apiSuccess(await listSessionAttendance(actor, sessionId, studentId));
  } catch (error) {
    return apiError(error, context.requestId);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { sessionId } = await params;
    const input = markAttendanceSchema.parse(await parseJsonBody(request));
    return apiSuccess(await markAttendance(actor, sessionId, input, context));
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
