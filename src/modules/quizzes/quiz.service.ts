import "server-only";

import { createHash } from "node:crypto";

import type { Actor } from "@/lib/auth/actor";
import { assertStaffClassAccess } from "@/lib/authorization/class-access";
import {
  canPublishOfficialGrade,
  canSuggestGrade,
} from "@/lib/authorization/permissions";
import { prisma } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import type { RequestContext } from "@/lib/security/request-context";
import { writeAuditLog } from "@/modules/audit/audit.service";

import { calculateAttemptExpiry, getQuizAvailability } from "./quiz-timing";
import type {
  gradeQuizAttemptSchema,
  saveQuizAnswersSchema,
} from "./quiz.schemas";
import type { z } from "zod";

type SaveQuizAnswersInput = z.infer<typeof saveQuizAnswersSchema>;
type GradeQuizAttemptInput = z.infer<typeof gradeQuizAttemptSchema>;

function deterministicRank(seed: string, value: string) {
  return createHash("sha256")
    .update(`${seed}:${value}`)
    .digest()
    .readUInt32BE(0);
}

function isObjectiveQuestion(type: string) {
  return [
    "SINGLE_CHOICE",
    "MULTIPLE_CHOICE",
    "TRUE_FALSE",
  ].includes(type);
}

async function getAccessibleQuiz(actor: Actor, quizId: string) {
  if (actor.role !== "STUDENT") throw new AppError("FORBIDDEN");
  const quiz = await prisma.quiz.findFirst({
    where: {
      id: quizId,
      content: {
        publicationStatus: "PUBLISHED",
        courseClass: {
          status: "ACTIVE",
          students: {
            some: { studentId: actor.id, status: "ACTIVE" },
          },
        },
      },
    },
    include: {
      content: { select: { classId: true, title: true, description: true } },
      questions: {
        orderBy: { order: "asc" },
        include: { choices: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!quiz) throw new AppError("FORBIDDEN");
  return quiz;
}

export async function startQuizAttempt(
  actor: Actor,
  quizId: string,
  context?: RequestContext,
) {
  const quiz = await getAccessibleQuiz(actor, quizId);
  const serverNow = new Date();
  if (
    getQuizAvailability({
      serverNow,
      opensAt: quiz.opensAt,
      closesAt: quiz.closesAt,
    }) !== "OPEN"
  ) {
    throw new AppError("CONFLICT", "Bài kiểm tra chưa mở hoặc đã đóng.");
  }

  return prisma.$transaction(
    async (tx) => {
      const current = await tx.quizAttempt.findFirst({
        where: {
          quizId,
          studentId: actor.id,
          status: "IN_PROGRESS",
        },
        orderBy: { attemptNumber: "desc" },
      });
      if (current && current.expiresAt > serverNow) return current;

      const attemptCount = await tx.quizAttempt.count({
        where: { quizId, studentId: actor.id },
      });
      if (attemptCount >= quiz.maxAttempts) {
        throw new AppError("CONFLICT", "Bạn đã sử dụng hết số lần làm bài.");
      }
      const attempt = await tx.quizAttempt.create({
        data: {
          quizId,
          studentId: actor.id,
          attemptNumber: attemptCount + 1,
          startedAt: serverNow,
          expiresAt: calculateAttemptExpiry({
            serverNow,
            durationMinutes: quiz.durationMinutes,
            quizClosesAt: quiz.closesAt,
          }),
        },
      });
      await writeAuditLog(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action: "QUIZ_ATTEMPT_STARTED",
        entityType: "QuizAttempt",
        entityId: attempt.id,
        newValue: {
          quizId,
          attemptNumber: attempt.attemptNumber,
          startedAt: attempt.startedAt,
          expiresAt: attempt.expiresAt,
        },
        context,
      });
      return attempt;
    },
    { isolationLevel: "Serializable" },
  );
}

export async function getQuizAttemptForStudent(
  actor: Actor,
  attemptId: string,
) {
  if (actor.role !== "STUDENT") throw new AppError("FORBIDDEN");
  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: attemptId, studentId: actor.id },
    include: {
      answers: true,
      quiz: {
        include: {
          content: {
            select: { title: true, description: true },
          },
          questions: {
            orderBy: { order: "asc" },
            include: { choices: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });
  if (!attempt) throw new AppError("NOT_FOUND");

  if (attempt.status === "IN_PROGRESS" && attempt.expiresAt <= new Date()) {
    await submitQuizAttempt(actor, attempt.id);
    return getQuizAttemptForStudent(actor, attemptId);
  }

  const canSeeResult =
    Boolean(attempt.publishedAt) &&
    (!attempt.quiz.showResultAt || attempt.quiz.showResultAt <= new Date());
  const canSeeCorrectAnswers =
    canSeeResult &&
    Boolean(attempt.quiz.showCorrectAnswersAt) &&
    attempt.quiz.showCorrectAnswersAt! <= new Date();

  return {
    id: attempt.id,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    serverNow: new Date(),
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    submittedAt: attempt.submittedAt,
    result: canSeeResult
      ? {
          finalScore: attempt.finalScore,
          maxScore: attempt.quiz.maxScore,
        }
      : null,
    questions: [...attempt.quiz.questions]
      .sort((left, right) =>
        attempt.quiz.shuffleQuestions
          ? deterministicRank(attempt.id, left.id) -
            deterministicRank(attempt.id, right.id)
          : left.order - right.order,
      )
      .map((question) => ({
        id: question.id,
        type: question.type,
        content: question.content,
        order: question.order,
        score: question.score,
        required: question.required,
        explanation: canSeeCorrectAnswers ? question.explanation : undefined,
        choices: [...question.choices]
          .sort((left, right) =>
            attempt.quiz.shuffleChoices
              ? deterministicRank(attempt.id, left.id) -
                deterministicRank(attempt.id, right.id)
              : left.order - right.order,
          )
          .map((choice) => ({
            id: choice.id,
            content: choice.content,
            order: choice.order,
            ...(canSeeCorrectAnswers ? { isCorrect: choice.isCorrect } : {}),
          })),
      })),
    answers: attempt.answers.map((answer) => ({
      questionId: answer.questionId,
      answerText: answer.answerText,
      selectedChoiceIds: answer.selectedChoiceIds,
      ...(canSeeResult
        ? {
            autoScore: answer.autoScore,
            manualScore: answer.manualScore,
            feedback: answer.feedback,
          }
        : {}),
    })),
  };
}

export async function saveQuizAnswers(
  actor: Actor,
  attemptId: string,
  input: SaveQuizAnswersInput,
) {
  if (actor.role !== "STUDENT") throw new AppError("FORBIDDEN");
  const attempt = await prisma.quizAttempt.findFirst({
    where: {
      id: attemptId,
      studentId: actor.id,
      status: "IN_PROGRESS",
    },
    include: {
      quiz: {
        include: {
          questions: { select: { id: true } },
        },
      },
    },
  });
  if (!attempt) throw new AppError("CONFLICT", "Lượt làm bài không hợp lệ.");
  if (attempt.expiresAt <= new Date()) {
    await submitQuizAttempt(actor, attemptId);
    throw new AppError("CONFLICT", "Bài đã hết giờ và được tự động nộp.");
  }

  const questionIds = new Set(
    attempt.quiz.questions.map((question) => question.id),
  );
  if (input.answers.some((answer) => !questionIds.has(answer.questionId))) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Câu trả lời không thuộc bài kiểm tra.",
    );
  }

  await prisma.$transaction(
    input.answers.map((answer) =>
      prisma.quizAnswer.upsert({
        where: {
          attemptId_questionId: {
            attemptId,
            questionId: answer.questionId,
          },
        },
        create: {
          attemptId,
          questionId: answer.questionId,
          answerText: answer.answerText,
          selectedChoiceIds: answer.selectedChoiceIds ?? [],
        },
        update: {
          answerText: answer.answerText,
          selectedChoiceIds: answer.selectedChoiceIds ?? [],
        },
      }),
    ),
  );
  return { savedAt: new Date() };
}

export async function submitQuizAttempt(
  actor: Actor,
  attemptId: string,
  context?: RequestContext,
) {
  if (actor.role !== "STUDENT") throw new AppError("FORBIDDEN");

  return prisma.$transaction(
    async (tx) => {
      const attempt = await tx.quizAttempt.findFirst({
        where: {
          id: attemptId,
          studentId: actor.id,
          status: "IN_PROGRESS",
        },
        include: {
          answers: true,
          quiz: {
            include: {
              questions: { include: { choices: true } },
            },
          },
        },
      });
      if (!attempt) {
        throw new AppError("CONFLICT", "Lượt làm bài không còn hiệu lực.");
      }

      const answerByQuestion = new Map(
        attempt.answers.map((answer) => [answer.questionId, answer]),
      );
      const missingRequired = attempt.quiz.questions.some((question) => {
        if (!question.required) return false;
        const answer = answerByQuestion.get(question.id);
        if (isObjectiveQuestion(question.type)) {
          return !(
            Array.isArray(answer?.selectedChoiceIds) &&
            answer.selectedChoiceIds.length > 0
          );
        }
        return !answer?.answerText?.trim();
      });
      if (missingRequired && new Date() < attempt.expiresAt) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Vui lòng hoàn thành tất cả câu hỏi bắt buộc.",
        );
      }
      let autoScore = 0;
      let requiresManualGrading = false;

      for (const question of attempt.quiz.questions) {
        const answer = answerByQuestion.get(question.id);
        if (!isObjectiveQuestion(question.type)) {
          requiresManualGrading = true;
          continue;
        }
        const selected = new Set(
          Array.isArray(answer?.selectedChoiceIds)
            ? (answer?.selectedChoiceIds as string[])
            : [],
        );
        const correct = new Set(
          question.choices
            .filter((choice) => choice.isCorrect)
            .map((choice) => choice.id),
        );
        const exact =
          selected.size === correct.size &&
          [...selected].every((id) => correct.has(id));
        const score = exact ? question.score.toNumber() : 0;
        autoScore += score;
        if (answer) {
          await tx.quizAnswer.update({
            where: { id: answer.id },
            data: { autoScore: score },
          });
        }
      }

      const now = new Date();
      const updated = await tx.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          status: requiresManualGrading ? "GRADING" : "GRADED",
          submittedAt: now,
          autoScore,
          finalScore: requiresManualGrading ? null : autoScore,
        },
        select: {
          id: true,
          status: true,
          submittedAt: true,
        },
      });
      await writeAuditLog(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action:
          now >= attempt.expiresAt
            ? "QUIZ_ATTEMPT_AUTO_SUBMITTED"
            : "QUIZ_ATTEMPT_SUBMITTED",
        entityType: "QuizAttempt",
        entityId: attempt.id,
        newValue: updated,
        context,
      });
      return updated;
    },
    { isolationLevel: "Serializable" },
  );
}

export async function gradeQuizAttempt(
  actor: Actor,
  attemptId: string,
  input: GradeQuizAttemptInput,
  context?: RequestContext,
) {
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: {
        select: {
          id: true,
          questionId: true,
          autoScore: true,
          manualScore: true,
        },
      },
      quiz: {
        select: {
          maxScore: true,
          content: { select: { classId: true } },
          questions: {
            select: {
              id: true,
              type: true,
              score: true,
            },
          },
        },
      },
    },
  });
  if (!attempt) throw new AppError("NOT_FOUND");
  await assertStaffClassAccess(actor, attempt.quiz.content.classId);

  if (!attempt.submittedAt || attempt.status === "IN_PROGRESS") {
    throw new AppError(
      "CONFLICT",
      "Lượt làm chưa được nộp nên chưa thể chấm điểm.",
    );
  }
  if (attempt.publishedAt) {
    throw new AppError("CONFLICT", "Điểm lượt làm này đã được công bố.");
  }

  if (input.action === "SUGGEST" && !canSuggestGrade(actor.role)) {
    throw new AppError("FORBIDDEN");
  }
  if (input.action !== "SUGGEST" && !canPublishOfficialGrade(actor.role)) {
    throw new AppError("FORBIDDEN");
  }

  if (input.action === "SUGGEST") {
    if (input.score > attempt.quiz.maxScore.toNumber()) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Điểm đề xuất vượt quá điểm tối đa của bài kiểm tra.",
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.quizAttempt.update({
        where: { id: attemptId },
        data: { assistantSuggestedScore: input.score },
        select: {
          id: true,
          status: true,
          finalScore: true,
          assistantSuggestedScore: true,
          publishedAt: true,
        },
      });
      await writeAuditLog(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action: "QUIZ_ATTEMPT_SUGGEST",
        entityType: "QuizAttempt",
        entityId: attemptId,
        oldValue: attempt,
        newValue: updated,
        reason: input.reason,
        context,
      });
      return updated;
    });
  }

  if (input.action === "PUBLISH") {
    if (attempt.finalScore === null) {
      throw new AppError(
        "CONFLICT",
        "Lượt làm phải được chấm hoàn tất trước khi công bố.",
      );
    }

    return prisma.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.quizAttempt.update({
        where: { id: attemptId },
        data: {
          publishedById: actor.id,
          publishedAt: now,
          status: "GRADED",
        },
        select: {
          id: true,
          status: true,
          finalScore: true,
          assistantSuggestedScore: true,
          publishedAt: true,
        },
      });
      await writeAuditLog(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action: "QUIZ_ATTEMPT_PUBLISH",
        entityType: "QuizAttempt",
        entityId: attemptId,
        oldValue: attempt,
        newValue: updated,
        reason: input.reason,
        context,
      });
      return updated;
    });
  }

  const manualQuestions = attempt.quiz.questions.filter(
    (question) => !isObjectiveQuestion(question.type),
  );
  const questionById = new Map(
    manualQuestions.map((question) => [question.id, question]),
  );
  const gradeByQuestion = new Map(
    input.answers.map((answer) => [answer.questionId, answer]),
  );

  if (gradeByQuestion.size !== input.answers.length) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Một câu hỏi đang được chấm nhiều lần.",
    );
  }

  for (const question of manualQuestions) {
    if (!gradeByQuestion.has(question.id)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Vui lòng chấm đầy đủ tất cả câu tự luận.",
      );
    }
  }

  for (const answerGrade of input.answers) {
    const question = questionById.get(answerGrade.questionId);
    if (!question) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Câu hỏi không hợp lệ hoặc đã được chấm tự động.",
      );
    }
    if (answerGrade.score > question.score.toNumber()) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Điểm một câu hỏi vượt quá điểm tối đa của câu.",
      );
    }
  }

  const manualScore = input.answers.reduce(
    (total, answerGrade) => total + answerGrade.score,
    0,
  );
  const autoScore = attempt.autoScore?.toNumber() ?? 0;
  const finalScore = autoScore + manualScore;

  if (finalScore > attempt.quiz.maxScore.toNumber()) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Tổng điểm vượt quá điểm tối đa của bài kiểm tra.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const now = new Date();

    for (const answerGrade of input.answers) {
      await tx.quizAnswer.upsert({
        where: {
          attemptId_questionId: {
            attemptId,
            questionId: answerGrade.questionId,
          },
        },
        create: {
          attemptId,
          questionId: answerGrade.questionId,
          selectedChoiceIds: [],
          manualScore: answerGrade.score,
          feedback: answerGrade.feedback,
        },
        update: {
          manualScore: answerGrade.score,
          feedback: answerGrade.feedback,
        },
      });
    }

    const updated = await tx.quizAttempt.update({
      where: { id: attemptId },
      data: {
        manualScore,
        finalScore,
        gradedById: actor.id,
        gradedAt: now,
        status: "GRADED",
      },
      select: {
        id: true,
        status: true,
        finalScore: true,
        assistantSuggestedScore: true,
        publishedAt: true,
      },
    });

    await writeAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "QUIZ_ATTEMPT_GRADE",
      entityType: "QuizAttempt",
      entityId: attemptId,
      oldValue: attempt,
      newValue: updated,
      reason: input.reason,
      context,
    });

    return updated;
  });
}
