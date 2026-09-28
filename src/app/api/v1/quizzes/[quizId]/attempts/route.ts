import { requireActor } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { getRequestContext } from "@/lib/security/request-context";
import {
  getLatestQuizAttemptForStudent,
  startQuizAttempt,
} from "@/modules/quizzes/quiz.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { quizId } = await params;
    return apiSuccess(
      await getLatestQuizAttemptForStudent(actor, quizId),
    );
  } catch (error) {
    return apiError(error, context.requestId);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { quizId } = await params;
    const attempt = await startQuizAttempt(actor, quizId, context);
    return apiSuccess(
      {
        id: attempt.id,
        attemptNumber: attempt.attemptNumber,
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
