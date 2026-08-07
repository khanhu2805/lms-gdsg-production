import { requireRoles } from "@/lib/auth/actor";
import { prisma } from "@/lib/database/client";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import {
  subjectInputSchema,
  subjectListQuerySchema,
} from "@/modules/subjects/subject.schemas";
import { createSubject } from "@/modules/subjects/subject.service";

export async function GET(request: Request) {
  const context = getRequestContext(request.headers);
  try {
    await requireRoles(["ADMIN", "MANAGER"], request.headers);
    const query = subjectListQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const subjects = await prisma.subject.findMany({
      where: {
        isActive: query.includeInactive ? undefined : true,
        OR: query.search
          ? [
              {
                code: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
              {
                name: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
            ]
          : undefined,
      },
      include: { _count: { select: { classes: true } } },
      orderBy: { name: "asc" },
    });
    return apiSuccess(subjects);
  } catch (error) {
    return apiError(error, context.requestId);
  }
}

export async function POST(request: Request) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireRoles(["ADMIN", "MANAGER"], request.headers);
    const input = subjectInputSchema.parse(await parseJsonBody(request));
    return apiSuccess(await createSubject(actor, input, context), {
      status: 201,
    });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
