import { requireActor, requireRoles } from "@/lib/auth/actor";
import { assertStaffClassAccess } from "@/lib/authorization/class-access";
import { prisma } from "@/lib/database/client";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { assignClassStaffSchema } from "@/modules/classes/class.schemas";
import { assignClassStaff } from "@/modules/classes/class.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { classId } = await params;
    await assertStaffClassAccess(actor, classId);
    const [teachers, assistants] = await Promise.all([
      prisma.classTeacher.findMany({
        where: { classId, status: "ACTIVE" },
        select: {
          id: true,
          type: true,
          teacher: { select: { id: true, name: true, email: true } },
        },
        orderBy: { type: "asc" },
      }),
      prisma.classAssistant.findMany({
        where: { classId, status: "ACTIVE" },
        select: {
          id: true,
          assistant: { select: { id: true, name: true, email: true } },
        },
        orderBy: { assistant: { name: "asc" } },
      }),
    ]);
    return apiSuccess({ teachers, assistants });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireRoles(["ADMIN", "MANAGER"], request.headers);
    const { classId } = await params;
    const input = assignClassStaffSchema.parse(await parseJsonBody(request));
    return apiSuccess(await assignClassStaff(actor, classId, input, context), {
      status: 201,
    });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
