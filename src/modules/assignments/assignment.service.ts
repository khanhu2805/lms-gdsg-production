import "server-only";

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

import type {
  gradeSubmissionSchema,
  saveSubmissionSchema,
} from "./assignment.schemas";
import type { z } from "zod";

type SaveSubmissionInput = z.infer<typeof saveSubmissionSchema>;
type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;

function isObjectiveQuestion(type: string) {
  return [
    "SINGLE_CHOICE",
    "MULTIPLE_CHOICE",
    "TRUE_FALSE",
  ].includes(type);
}

export async function getStudentAssignment(actor: Actor, assignmentId: string) {
  if (actor.role !== "STUDENT") throw new AppError("FORBIDDEN");
  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
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
    select: {
      id: true,
      opensAt: true,
      dueAt: true,
      allowLateSubmission: true,
      maxAttempts: true,
      maxScore: true,
      content: {
        select: {
          title: true,
          description: true,
          classSessionId: true,
        },
      },
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          type: true,
          content: true,
          order: true,
          score: true,
          explanation: true,
          required: true,
          choices: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              content: true,
              order: true,
            },
          },
        },
      },
      submissions: {
        where: { studentId: actor.id },
        orderBy: { attemptNumber: "desc" },
        take: 1,
        select: {
          id: true,
          attemptNumber: true,
          status: true,
          submittedAt: true,
          isLate: true,
          finalScore: true,
          teacherFeedback: true,
          publishedAt: true,
          answers: {
            select: {
              questionId: true,
              answerText: true,
              selectedChoiceIds: true,
              autoScore: true,
              manualScore: true,
              feedback: true,
            },
          },
          files: {
            select: {
              asset: {
                select: {
                  id: true,
                  originalName: true,
                  mimeType: true,
                  sizeBytes: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!assignment) throw new AppError("FORBIDDEN");
  return {
    ...assignment,
    submissions: assignment.submissions.map((submission) => ({
      ...submission,
      files: submission.files.map(({ asset }) => ({
        ...asset,
        sizeBytes: asset.sizeBytes.toString(),
        downloadUrl: `/api/v1/assets/${asset.id}/download`,
      })),
      finalScore: submission.publishedAt ? submission.finalScore : null,
      teacherFeedback: submission.publishedAt
        ? submission.teacherFeedback
        : null,
      answers: submission.answers.map((answer) => ({
        questionId: answer.questionId,
        answerText: answer.answerText,
        selectedChoiceIds: answer.selectedChoiceIds,
        ...(submission.publishedAt
          ? {
              autoScore: answer.autoScore,
              manualScore: answer.manualScore,
              feedback: answer.feedback,
            }
          : {}),
      })),
    })),
  };
}

function calculateObjectiveScore(
  question: {
    type: string;
    score: { toNumber(): number };
    choices: Array<{ id: string; isCorrect: boolean }>;
  },
  answer: { selectedChoiceIds?: string[] },
) {
  if (!isObjectiveQuestion(question.type)) {
    return null;
  }
  const selected = new Set(answer.selectedChoiceIds ?? []);
  const correct = new Set(
    question.choices
      .filter((choice) => choice.isCorrect)
      .map((choice) => choice.id),
  );
  const exact =
    selected.size === correct.size &&
    [...selected].every((id) => correct.has(id));
  return exact ? question.score.toNumber() : 0;
}

export async function saveAssignmentSubmission(
  actor: Actor,
  assignmentId: string,
  input: SaveSubmissionInput,
  context?: RequestContext,
) {
  if (actor.role !== "STUDENT") throw new AppError("FORBIDDEN");

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
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
      content: { select: { classId: true } },
      questions: { include: { choices: true } },
    },
  });
  if (!assignment) throw new AppError("FORBIDDEN");

  const now = new Date();
  if (assignment.opensAt && now < assignment.opensAt) {
    throw new AppError("CONFLICT", "Bài tập chưa mở.");
  }
  const isLate = Boolean(assignment.dueAt && now > assignment.dueAt);
  if (isLate && !assignment.allowLateSubmission) {
    throw new AppError("CONFLICT", "Bài tập đã hết hạn nộp.");
  }

  const questionById = new Map(
    assignment.questions.map((question) => [question.id, question]),
  );
  for (const answer of input.answers) {
    if (!questionById.has(answer.questionId)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Câu trả lời không thuộc bài tập.",
      );
    }
  }
  const uniqueFileIds = [...new Set(input.fileAssetIds)];
  const fileAssets =
    uniqueFileIds.length > 0
      ? await prisma.asset.findMany({
          where: {
            id: { in: uniqueFileIds },
            uploadedById: actor.id,
            category: "SUBMISSION",
            status: "READY",
            deletedAt: null,
          },
          select: { id: true },
        })
      : [];
  if (fileAssets.length !== uniqueFileIds.length) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Một hoặc nhiều file bài nộp không hợp lệ.",
    );
  }
  if (input.action === "SUBMIT") {
    const answerByQuestion = new Map(
      input.answers.map((answer) => [answer.questionId, answer]),
    );
    const missingRequired = assignment.questions.some((question) => {
      if (!question.required) return false;
      const answer = answerByQuestion.get(question.id);
      if (question.type === "FILE_UPLOAD") return uniqueFileIds.length === 0;
      if (isObjectiveQuestion(question.type)) {
        return !answer?.selectedChoiceIds?.length;
      }
      return !answer?.answerText?.trim();
    });
    if (missingRequired) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Vui lòng hoàn thành tất cả câu hỏi bắt buộc.",
      );
    }
  }

  return prisma.$transaction(
    async (tx) => {
      let submission = await tx.submission.findFirst({
        where: {
          assignmentId,
          studentId: actor.id,
          status: "DRAFT",
        },
        orderBy: { attemptNumber: "desc" },
      });

      if (!submission) {
        const attemptCount = await tx.submission.count({
          where: { assignmentId, studentId: actor.id },
        });
        if (attemptCount >= assignment.maxAttempts) {
          throw new AppError("CONFLICT", "Bạn đã sử dụng hết số lần làm bài.");
        }
        submission = await tx.submission.create({
          data: {
            assignmentId,
            studentId: actor.id,
            attemptNumber: attemptCount + 1,
          },
        });
      }

      let autoScore = 0;
      const requiresManualGrading = assignment.questions.some(
        (question) => !isObjectiveQuestion(question.type),
      );
      for (const answer of input.answers) {
        const question = questionById.get(answer.questionId)!;
        const questionAutoScore = calculateObjectiveScore(question, answer);
        if (questionAutoScore !== null) autoScore += questionAutoScore;

        await tx.submissionAnswer.upsert({
          where: {
            submissionId_questionId: {
              submissionId: submission.id,
              questionId: answer.questionId,
            },
          },
          create: {
            submissionId: submission.id,
            questionId: answer.questionId,
            answerText: answer.answerText,
            selectedChoiceIds: answer.selectedChoiceIds ?? [],
            autoScore: questionAutoScore,
          },
          update: {
            answerText: answer.answerText,
            selectedChoiceIds: answer.selectedChoiceIds ?? [],
            autoScore: questionAutoScore,
          },
        });
      }
      await tx.submissionFile.deleteMany({
        where: { submissionId: submission.id },
      });
      if (uniqueFileIds.length > 0) {
        await tx.submissionFile.createMany({
          data: uniqueFileIds.map((assetId) => ({
            submissionId: submission.id,
            assetId,
          })),
        });
      }

      const updated = await tx.submission.update({
        where: { id: submission.id },
        data:
          input.action === "SUBMIT"
            ? {
                status: requiresManualGrading ? "GRADING" : "GRADED",
                submittedAt: now,
                isLate,
                autoScore,
                finalScore: requiresManualGrading ? null : autoScore,
              }
            : {
                autoScore,
                isLate,
              },
        select: {
          id: true,
          attemptNumber: true,
          status: true,
          submittedAt: true,
          isLate: true,
        },
      });

      if (input.action === "SUBMIT") {
        await writeAuditLog(tx, {
          actorId: actor.id,
          actorRole: actor.role,
          action: "ASSIGNMENT_SUBMITTED",
          entityType: "Submission",
          entityId: submission.id,
          newValue: updated,
          context,
        });
      }
      return updated;
    },
    { isolationLevel: "Serializable" },
  );
}

export async function gradeSubmission(
  actor: Actor,
  submissionId: string,
  input: GradeSubmissionInput,
  context?: RequestContext,
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: {
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
  if (!submission) throw new AppError("NOT_FOUND");
  await assertStaffClassAccess(actor, submission.assignment.content.classId);

  if (!submission.submittedAt || submission.status === "DRAFT") {
    throw new AppError(
      "CONFLICT",
      "Bài làm chưa được nộp nên chưa thể chấm điểm.",
    );
  }
  if (submission.publishedAt) {
    throw new AppError("CONFLICT", "Điểm bài làm này đã được công bố.");
  }

  if (input.action === "SUGGEST" && !canSuggestGrade(actor.role)) {
    throw new AppError("FORBIDDEN");
  }
  if (input.action !== "SUGGEST" && !canPublishOfficialGrade(actor.role)) {
    throw new AppError("FORBIDDEN");
  }

  if (input.action === "SUGGEST") {
    if (input.score > submission.assignment.maxScore.toNumber()) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Điểm đề xuất vượt quá điểm tối đa của bài tập.",
      );
    }
  }

  if (input.action === "PUBLISH" && submission.finalScore === null) {
    throw new AppError(
      "CONFLICT",
      "Bài nộp phải có điểm cuối trước khi công bố.",
    );
  }

  if (input.action === "GRADE") {
    const manualQuestions = submission.assignment.questions.filter(
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
          "Vui lòng chấm đầy đủ tất cả câu tự luận hoặc câu nộp file.",
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
  }

  return prisma.$transaction(async (tx) => {
    const now = new Date();

    if (input.action === "GRADE") {
      for (const answerGrade of input.answers) {
        await tx.submissionAnswer.upsert({
          where: {
            submissionId_questionId: {
              submissionId,
              questionId: answerGrade.questionId,
            },
          },
          create: {
            submissionId,
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
    }

    const manualScore =
      input.action === "GRADE"
        ? input.answers.reduce(
            (total, answerGrade) => total + answerGrade.score,
            0,
          )
        : null;
    const autoScore = submission.autoScore?.toNumber() ?? 0;
    const finalScore =
      manualScore === null ? null : autoScore + manualScore;

    if (
      finalScore !== null &&
      finalScore > submission.assignment.maxScore.toNumber()
    ) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Tổng điểm vượt quá điểm tối đa của bài tập.",
      );
    }

    const updated = await tx.submission.update({
      where: { id: submissionId },
      data:
        input.action === "SUGGEST"
          ? {
              assistantSuggestedScore: input.score,
              assistantSuggestedFeedback: input.feedback,
            }
          : input.action === "GRADE"
            ? {
                manualScore,
                finalScore,
                teacherFeedback: input.feedback,
                gradedById: actor.id,
                gradedAt: now,
                status: "GRADED",
              }
            : input.action === "PUBLISH"
              ? {
                  publishedById: actor.id,
                  publishedAt: now,
                  status: "GRADED",
                }
              : input.action === "RETURN"
                ? { status: "RETURNED" }
                : {
                    status: "RESUBMISSION_REQUIRED",
                    publishedAt: null,
                    publishedById: null,
                  },
    });

    await writeAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: `SUBMISSION_${input.action}`,
      entityType: "Submission",
      entityId: submissionId,
      oldValue: submission,
      newValue: updated,
      reason: input.reason,
      context,
    });

    return {
      id: updated.id,
      status: updated.status,
      publishedAt: updated.publishedAt,
    };
  });
}
