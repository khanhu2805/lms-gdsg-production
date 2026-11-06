import { requireActor } from "@/lib/auth/actor";
import { assertStaffClassAccess } from "@/lib/authorization/class-access";
import { prisma } from "@/lib/database/client";
import { apiError } from "@/lib/errors/api-response";
import { AppError } from "@/lib/errors/app-error";
import { getRequestContext } from "@/lib/security/request-context";
import { exportStudentAnswers } from "@/modules/grading/answers-export.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contentId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { contentId } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contentId)) {
      throw new AppError("BAD_REQUEST");
    }
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: { classId: true, type: true, assignment: { select: { id: true } }, quiz: { select: { id: true } } },
    });
    if (!content) throw new AppError("NOT_FOUND");
    await assertStaffClassAccess(actor, content.classId);
    const kind = content.type === "ASSIGNMENT" ? "assignment" : content.type === "QUIZ" ? "quiz" : null;
    const activityId = kind === "assignment" ? content.assignment?.id : content.quiz?.id;
    if (!kind || !activityId) throw new AppError("BAD_REQUEST");
    const file = await exportStudentAnswers(actor, kind, activityId);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": "attachment; filename=\"tong-hop-bai-lam-" + contentId + ".docx\"",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
