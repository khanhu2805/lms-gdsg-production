import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/actor";
import { prisma } from "@/lib/database/client";

export function classScopeWhere(actor: Actor): Prisma.CourseClassWhereInput {
  switch (actor.role) {
    case "ADMIN":
    case "MANAGER":
      return {};
    case "TEACHER":
      return {
        teachers: {
          some: { teacherId: actor.id, status: "ACTIVE" },
        },
      };
    case "TEACHING_ASSISTANT":
      return {
        assistants: {
          some: { assistantId: actor.id, status: "ACTIVE" },
        },
      };
    case "STUDENT":
      return {
        students: {
          some: { studentId: actor.id, status: "ACTIVE" },
        },
        status: "ACTIVE",
      };
    case "PARENT":
      return {
        students: {
          some: {
            status: "ACTIVE",
            student: {
              studentParentLinks: {
                some: { parentId: actor.id, status: "ACTIVE" },
              },
            },
          },
        },
        status: "ACTIVE",
      };
  }
}

export function listScopedClasses(
  actor: Actor,
  where: Prisma.CourseClassWhereInput,
  page: number,
  pageSize: number,
) {
  const scopedWhere = {
    AND: [classScopeWhere(actor), where],
  } satisfies Prisma.CourseClassWhereInput;

  return Promise.all([
    prisma.courseClass.findMany({
      where: scopedWhere,
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
        overCapacitySince: true,
        subject: { select: { id: true, code: true, name: true } },
        _count: {
          select: {
            students: {
              where: { status: "ACTIVE" },
            },
          },
        },
      },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.courseClass.count({ where: scopedWhere }),
  ]);
}
