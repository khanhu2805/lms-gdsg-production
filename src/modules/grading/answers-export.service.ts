import "server-only";

import type { Actor } from "@/lib/auth/actor";
import { assertStaffClassAccess } from "@/lib/authorization/class-access";
import { prisma } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import { buildAnswersWord } from "./answers-export";

/** Export every submitted attempt for exactly one assignment or quiz. */
export async function exportStudentAnswers(
  actor: Actor, kind: "assignment" | "quiz", activityId: string,
) {
  if (kind === "assignment") {
    const scope = await prisma.assignment.findUnique({
      where: { id: activityId }, select: { content: { select: { classId: true } } },
    });
    if (!scope) throw new AppError("NOT_FOUND");
    await assertStaffClassAccess(actor, scope.content.classId);
    const assignment = await prisma.assignment.findUnique({
      where: { id: activityId },
      select: {
        maxScore: true,
        content: { select: { title: true, courseClass: { select: { code: true } } } },
        questions: {
          orderBy: { order: "asc" },
          select: {
            id: true, order: true, content: true, score: true,
            group: { select: { title: true, content: true } },
            choices: { orderBy: { order: "asc" }, select: { id: true, content: true, order: true } },
          },
        },
        submissions: {
          where: { status: { not: "DRAFT" }, submittedAt: { not: null } },
          orderBy: [{ submittedAt: "asc" }, { attemptNumber: "asc" }],
          select: {
            attemptNumber: true, submittedAt: true, publishedAt: true,
            finalScore: true, teacherFeedback: true,
            student: { select: { name: true, email: true, profile: { select: { studentCode: true } } } },
            answers: { select: {
              questionId: true, answerText: true, selectedChoiceIds: true,
              autoScore: true, manualScore: true, feedback: true,
            } },
            files: { select: { asset: { select: { originalName: true } } } },
          },
        },
      },
    });
    if (!assignment) throw new AppError("NOT_FOUND");
    return buildAnswersWord({
      title: assignment.content.title, classCode: assignment.content.courseClass.code,
      maxScore: assignment.maxScore, questions: assignment.questions,
      attempts: assignment.submissions,
    });
  }

  const scope = await prisma.quiz.findUnique({
    where: { id: activityId }, select: { content: { select: { classId: true } } },
  });
  if (!scope) throw new AppError("NOT_FOUND");
  await assertStaffClassAccess(actor, scope.content.classId);
  const quiz = await prisma.quiz.findUnique({
    where: { id: activityId },
    select: {
      maxScore: true,
      content: { select: { title: true, courseClass: { select: { code: true } } } },
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true, order: true, content: true, score: true,
          group: { select: { title: true, content: true } },
          choices: { orderBy: { order: "asc" }, select: { id: true, content: true, order: true } },
        },
      },
      attempts: {
        where: { status: { not: "IN_PROGRESS" }, submittedAt: { not: null } },
        orderBy: [{ submittedAt: "asc" }, { attemptNumber: "asc" }],
        select: {
          attemptNumber: true, submittedAt: true, publishedAt: true,
          finalScore: true, teacherFeedback: true,
          student: { select: { name: true, email: true, profile: { select: { studentCode: true } } } },
          answers: { select: {
            questionId: true, answerText: true, selectedChoiceIds: true,
            autoScore: true, manualScore: true, feedback: true,
          } },
        },
      },
    },
  });
  if (!quiz) throw new AppError("NOT_FOUND");
  return buildAnswersWord({
    title: quiz.content.title, classCode: quiz.content.courseClass.code,
    maxScore: quiz.maxScore, questions: quiz.questions,
    attempts: quiz.attempts,
  });
}
