import { requireRoles } from "@/lib/auth/actor";
import { prisma } from "@/lib/database/client";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { AppError } from "@/lib/errors/app-error";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { subjectUpdateSchema } from "@/modules/subjects/subject.schemas";
import { updateSubject } from "@/modules/subjects/subject.service";
import { z } from "zod";

const deactivateSubjectSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ subjectId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    await requireRoles(["ADMIN", "MANAGER"], request.headers);
    const { subjectId } = await params;
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        classes: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            academicYear: true,
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        _count: { select: { classes: true } },
      },
    });
    if (!subject) throw new AppError("NOT_FOUND");
    return apiSuccess(subject);
  } catch (error) {
    return apiError(error, context.requestId);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ subjectId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireRoles(["ADMIN", "MANAGER"], request.headers);
    const { subjectId } = await params;
    const input = subjectUpdateSchema.parse(await parseJsonBody(request));
    return apiSuccess(await updateSubject(actor, subjectId, input, context));
  } catch (error) {
    return apiError(error, context.requestId);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ subjectId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireRoles(["ADMIN", "MANAGER"], request.headers);
    const { subjectId } = await params;
    const { reason } = deactivateSubjectSchema.parse(
      await parseJsonBody(request),
    );
    return apiSuccess(
      await updateSubject(
        actor,
        subjectId,
        { isActive: false, reason },
        context,
      ),
    );
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
