import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/client";

export function listUsers(
  where: Prisma.UserWhereInput,
  page: number,
  pageSize: number,
) {
  return Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        status: true,
        lockedAt: true,
        deletedAt: true,
        lastLoginAt: true,
        createdAt: true,
        profile: {
          select: {
            phone: true,
            studentCode: true,
            teacherCode: true,
            assistantCode: true,
            parentCode: true,
          },
        },
      },
      orderBy: [{ deletedAt: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);
}
