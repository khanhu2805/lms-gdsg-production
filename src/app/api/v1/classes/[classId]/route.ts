import { requireActor, requireRoles } from "@/lib/auth/actor";
import { assertClassAccess } from "@/lib/authorization/class-access";
import { prisma } from "@/lib/database/client";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { AppError } from "@/lib/errors/app-error";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { updateClassSchema } from "@/modules/classes/class.schemas";
import { updateCourseClass } from "@/modules/classes/class.service";
import { calculateCapacity } from "@/modules/classes/capacity";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { classId } = await params;
    await assertClassAccess(actor, classId);
    const isStaff = [
      "ADMIN",
      "MANAGER",
      "TEACHER",
      "TEACHING_ASSISTANT",
    ].includes(actor.role);
    const courseClass = await prisma.courseClass.findUnique({
      where: { id: classId },
      select: {
        id: true,
        code: true,
        name: true,
        academicYear: true,
        startDate: true,
        endDate: true,
        mode: true,
        capacity: true,
        status: true,
        description: true,
        internalNote: isStaff,
        version: true,
        subject: { select: { id: true, code: true, name: true } },
        teachers: {
          where: { status: "ACTIVE" },
          select: {
            type: true,
            teacher: { select: { id: true, name: true } },
          },
        },
        assistants: isStaff
          ? {
              where: { status: "ACTIVE" as const },
              select: {
                assistant: { select: { id: true, name: true } },
              },
            }
          : false,
        _count: {
          select: {
            students: { where: { status: "ACTIVE" } },
            sessions: true,
          },
        },
      },
    });
    if (!courseClass) {
      throw new AppError("NOT_FOUND");
    }
    return apiSuccess({
      ...courseClass,
      capacitySummary: calculateCapacity(
        courseClass.capacity,
        courseClass._count.students,
      ),
    });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireRoles(["ADMIN", "MANAGER"], request.headers);
    const { classId } = await params;
    const input = updateClassSchema.parse(await parseJsonBody(request));
    const courseClass = await updateCourseClass(actor, classId, input, context);
    return apiSuccess(courseClass);
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
