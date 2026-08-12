import "server-only";

import type { Actor } from "@/lib/auth/actor";
import { prisma } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";

export type ParentChildOption = {
  id: string;
  name: string;
  studentCode: string | null;
  isPrimary: boolean;
};

export async function resolveParentContext(
  actor: Actor,
  requestedStudentId?: string,
) {
  if (actor.role !== "PARENT") throw new AppError("FORBIDDEN");

  const links = await prisma.parentStudentLink.findMany({
    where: { parentId: actor.id, status: "ACTIVE" },
    select: {
      studentId: true,
      isPrimary: true,
      linkedAt: true,
      student: {
        select: {
          name: true,
          profile: { select: { studentCode: true } },
        },
      },
    },
    orderBy: [{ isPrimary: "desc" }, { linkedAt: "asc" }],
  });

  const children: ParentChildOption[] = links.map((link) => ({
    id: link.studentId,
    name: link.student.name,
    studentCode: link.student.profile?.studentCode ?? null,
    isPrimary: link.isPrimary,
  }));

  if (!children.length) {
    return { children, selectedStudentId: null, selectedChild: null };
  }

  if (requestedStudentId && !children.some((child) => child.id === requestedStudentId)) {
    throw new AppError("FORBIDDEN");
  }

  const selectedChild =
    children.find((child) => child.id === requestedStudentId) ?? children[0];

  return {
    children,
    selectedStudentId: selectedChild.id,
    selectedChild,
  };
}
