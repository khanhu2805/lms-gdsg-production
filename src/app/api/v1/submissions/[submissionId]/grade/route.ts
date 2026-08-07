import { requireActor } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { gradeSubmissionSchema } from "@/modules/assignments/assignment.schemas";
import { gradeSubmission } from "@/modules/assignments/assignment.service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { submissionId } = await params;
    const input = gradeSubmissionSchema.parse(await parseJsonBody(request));
    return apiSuccess(
      await gradeSubmission(actor, submissionId, input, context),
    );
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
