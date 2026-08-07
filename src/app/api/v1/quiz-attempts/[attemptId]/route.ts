import { requireActor } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { saveQuizAnswersSchema } from "@/modules/quizzes/quiz.schemas";
import {
  getQuizAttemptForStudent,
  saveQuizAnswers,
  submitQuizAttempt,
} from "@/modules/quizzes/quiz.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { attemptId } = await params;
    return apiSuccess(await getQuizAttemptForStudent(actor, attemptId));
  } catch (error) {
    return apiError(error, context.requestId);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { attemptId } = await params;
    const input = saveQuizAnswersSchema.parse(await parseJsonBody(request));
    return apiSuccess(await saveQuizAnswers(actor, attemptId, input));
  } catch (error) {
    return apiError(error, context.requestId);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { attemptId } = await params;
    return apiSuccess(await submitQuizAttempt(actor, attemptId, context));
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
