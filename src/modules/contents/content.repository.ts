import "server-only";

import { prisma } from "@/lib/database/client";
import type { Actor } from "@/lib/auth/actor";
import { assertClassAccess } from "@/lib/authorization/class-access";

export function findContentForWorkflow(contentId: string) {
  return prisma.content.findUnique({
    where: { id: contentId, deletedAt: null },
    include: {
      creator: {
        select: { id: true, name: true, email: true, role: true },
      },
      courseClass: {
        select: { id: true, code: true, name: true },
      },
      classSession: {
        select: { id: true, sessionNumber: true, title: true },
      },
      reviews: {
        include: {
          reviewer: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      lesson: true,
      material: true,
      recording: true,
      assignment: {
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: { choices: { orderBy: { order: "asc" } } },
          },
        },
      },
      quiz: {
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: { choices: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });
}

export async function listAccessibleContents(
  actor: Actor,
  input: {
    classId: string;
    classSessionId?: string;
  },
) {
  await assertClassAccess(actor, input.classId);
  const isLearner = ["STUDENT", "PARENT"].includes(actor.role);

  return prisma.content.findMany({
    where: {
      classId: input.classId,
      classSessionId: input.classSessionId,
      deletedAt: null,
      publicationStatus: isLearner ? "PUBLISHED" : undefined,
    },
    select: {
      id: true,
      classSessionId: true,
      type: true,
      title: true,
      description: true,
      publicationStatus: true,
      version: true,
      publishedAt: true,
      lockedAt: true,
      creator: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      recording: {
        select: {
          id: true,
          processingStatus: true,
          durationSeconds: true,
        },
      },
      material: {
        select: {
          id: true,
          title: true,
          mimeType: true,
          sizeBytes: true,
        },
      },
      assignment: {
        select: {
          id: true,
          opensAt: true,
          dueAt: true,
          maxScore: true,
        },
      },
      quiz: {
        select: {
          id: true,
          opensAt: true,
          closesAt: true,
          durationMinutes: true,
          maxScore: true,
        },
      },
    },
    orderBy: [{ classSessionId: "asc" }, { createdAt: "asc" }],
  });
}
