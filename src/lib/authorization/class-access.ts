import "server-only";

import type { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";

import type { Actor } from "@/lib/auth/actor";

export async function assertClassAccess(actor: Actor, classId: string) {
  const whereByRole: Record<UserRole, Record<string, unknown>> = {
    ADMIN: {},
    MANAGER: {},
    TEACHER: {
      teachers: {
        some: {
          teacherId: actor.id,
          status: "ACTIVE",
        },
      },
    },
    TEACHING_ASSISTANT: {
      assistants: {
        some: {
          assistantId: actor.id,
          status: "ACTIVE",
        },
      },
    },
    STUDENT: {
      students: {
        some: {
          studentId: actor.id,
          status: "ACTIVE",
        },
      },
    },
    PARENT: {
      students: {
        some: {
          status: "ACTIVE",
          student: {
            studentParentLinks: {
              some: {
                parentId: actor.id,
                status: "ACTIVE",
              },
            },
          },
        },
      },
    },
  };

  const courseClass = await prisma.courseClass.findFirst({
    where: {
      id: classId,
      ...(actor.role === "STUDENT" || actor.role === "PARENT"
        ? { status: "ACTIVE" as const }
        : {}),
      ...whereByRole[actor.role],
    },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
    },
  });

  if (!courseClass) {
    throw new AppError("FORBIDDEN");
  }
  return courseClass;
}

export async function assertStaffClassAccess(actor: Actor, classId: string) {
  if (
    !["ADMIN", "MANAGER", "TEACHER", "TEACHING_ASSISTANT"].includes(actor.role)
  ) {
    throw new AppError("FORBIDDEN");
  }
  return assertClassAccess(actor, classId);
}

export async function assertParentStudentLink(
  parentId: string,
  studentId: string,
) {
  const link = await prisma.parentStudentLink.findFirst({
    where: {
      parentId,
      studentId,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (!link) throw new AppError("FORBIDDEN");
  return link;
}
