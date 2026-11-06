import { requireActor } from "@/lib/auth/actor";
import { apiError } from "@/lib/errors/api-response";
import { AppError } from "@/lib/errors/app-error";
import { getRequestContext } from "@/lib/security/request-context";
import { exportStudentAnswers } from "@/modules/grading/answers-export.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string; activityId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { kind, activityId } = await params;
    if (kind !== "assignment" && kind !== "quiz") throw new AppError("BAD_REQUEST");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activityId)) {
      throw new AppError("BAD_REQUEST");
    }
    const file = await exportStudentAnswers(actor, kind, activityId);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": "attachment; filename=\"bai-lam-" + kind + "-" + activityId + ".docx\"",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
