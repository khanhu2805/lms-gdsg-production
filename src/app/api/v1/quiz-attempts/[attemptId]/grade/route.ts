import { requireActor } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { gradeQuizAttemptSchema } from "@/modules/quizzes/quiz.schemas";
import { gradeQuizAttempt } from "@/modules/quizzes/quiz.service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { attemptId } = await params;
    const input = gradeQuizAttemptSchema.parse(await parseJsonBody(request));
    return apiSuccess(await gradeQuizAttempt(actor, attemptId, input, context));
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
