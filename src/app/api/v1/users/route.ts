import type { Prisma } from "@/generated/prisma/client";
import { requireRoles } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { AppError } from "@/lib/errors/app-error";
import { parseJsonBody } from "@/lib/errors/request";
import { getRequestContext } from "@/lib/security/request-context";
import { listUsers } from "@/modules/users/user.repository";
import {
  createUserSchema,
  userListQuerySchema,
} from "@/modules/users/user.schemas";
import { createManagedUser } from "@/modules/users/user.service";

export async function GET(request: Request) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireRoles(["ADMIN", "MANAGER"], request.headers);
    const url = new URL(request.url);
    const query = userListQuerySchema.parse(
      Object.fromEntries(url.searchParams),
    );
    if (actor.role === "MANAGER" && query.role === "ADMIN") {
      throw new AppError(
        "FORBIDDEN",
        "Quản lý không được xem hoặc tác động tới tài khoản quản trị viên.",
      );
    }
    const where: Prisma.UserWhereInput = {
      role:
        query.role ?? (actor.role === "MANAGER" ? { not: "ADMIN" } : undefined),
      status: query.status,
      OR: query.search
        ? [
            { name: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } },
            {
              profile: {
                is: {
                  OR: [
                    {
                      studentCode: {
                        contains: query.search,
                        mode: "insensitive",
                      },
                    },
                    {
                      teacherCode: {
                        contains: query.search,
                        mode: "insensitive",
                      },
                    },
                  ],
                },
              },
            },
          ]
        : undefined,
    };
    const [users, total] = await listUsers(where, query.page, query.pageSize);
    return apiSuccess(users, {
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}

export async function POST(request: Request) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireRoles(["ADMIN", "MANAGER"], request.headers);
    const input = createUserSchema.parse(await parseJsonBody(request));
    const user = await createManagedUser(actor, input, context);
    return apiSuccess(user, { status: 201 });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
