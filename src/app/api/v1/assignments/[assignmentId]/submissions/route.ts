import { requireActor } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { saveSubmissionSchema } from "@/modules/assignments/assignment.schemas";
import { saveAssignmentSubmission } from "@/modules/assignments/assignment.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { assignmentId } = await params;
    const input = saveSubmissionSchema.parse(await parseJsonBody(request));
    return apiSuccess(
      await saveAssignmentSubmission(actor, assignmentId, input, context),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
