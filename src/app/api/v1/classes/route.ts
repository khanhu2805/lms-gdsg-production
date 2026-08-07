import type { Prisma } from "@/generated/prisma/client";
import { requireActor, requireRoles } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { listScopedClasses } from "@/modules/classes/class.repository";
import {
  classListQuerySchema,
  createClassSchema,
} from "@/modules/classes/class.schemas";
import { createCourseClass } from "@/modules/classes/class.service";
import { calculateCapacity } from "@/modules/classes/capacity";

export async function GET(request: Request) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const query = classListQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const where: Prisma.CourseClassWhereInput = {
      status: query.status,
      OR: query.search
        ? [
            { name: { contains: query.search, mode: "insensitive" } },
            { code: { contains: query.search, mode: "insensitive" } },
          ]
        : undefined,
    };
    const [classes, total] = await listScopedClasses(
      actor,
      where,
      query.page,
      query.pageSize,
    );
    return apiSuccess(
      classes.map((courseClass) => ({
        ...courseClass,
        capacitySummary: calculateCapacity(
          courseClass.capacity,
          courseClass._count.students,
        ),
      })),
      {
        meta: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize),
        },
      },
    );
  } catch (error) {
    return apiError(error, context.requestId);
  }
}

export async function POST(request: Request) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireRoles(["ADMIN", "MANAGER"], request.headers);
    const input = createClassSchema.parse(await parseJsonBody(request));
    const courseClass = await createCourseClass(actor, input, context);
    return apiSuccess(courseClass, { status: 201 });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
