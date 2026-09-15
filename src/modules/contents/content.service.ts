import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/auth/actor";
import {
  assertClassAccess,
  assertStaffClassAccess,
} from "@/lib/authorization/class-access";
import { prisma } from "@/lib/database/client";
import { AppError } from "@/lib/errors/app-error";
import type { RequestContext } from "@/lib/security/request-context";
import { writeAuditLog } from "@/modules/audit/audit.service";

import {
  canEditContent,
  resolveContentTransition,
} from "./content.permissions";
import { findContentForWorkflow } from "./content.repository";
import type { ContentAction } from "./content.types";
import type {
  createContentSchema,
  updateContentSchema,
} from "./content.schemas";
import type { z } from "zod";

type WorkflowInput = {
  action: ContentAction;
  comment?: string;
  reason?: string;
};

type CreateContentInput = z.infer<typeof createContentSchema>;
type UpdateContentInput = z.infer<typeof updateContentSchema>;

type TransactionClient = Prisma.TransactionClient;

type CleanupTarget = {
  storageKey: string;
  recursive?: boolean;
};

const contentRelations = {
  lesson: true,
  material: true,
  recording: true,
  assignment: {
    include: {
      questions: {
        orderBy: { order: "asc" as const },
        include: { choices: { orderBy: { order: "asc" as const } } },
      },
    },
  },
  quiz: {
    include: {
      questions: {
        orderBy: { order: "asc" as const },
        include: { choices: { orderBy: { order: "asc" as const } } },
      },
    },
  },
};
const OFFICE_PREVIEW_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function materialPreviewPlan(mimeType: string, storageKey: string) {
  if (OFFICE_PREVIEW_MIME_TYPES.has(mimeType)) {
    return {
      previewStatus: "PENDING" as const,
      previewStorageKey: null,
      previewError: null,
      needsConversion: true,
    };
  }

  return {
    previewStatus: "READY" as const,
    previewStorageKey: storageKey,
    previewError: null,
    needsConversion: false,
  };
}
function assertQuestionScore(
  questions: Array<{ score: number }>,
  maxScore: number,
) {
  const total = questions.reduce((sum, question) => sum + question.score, 0);
  if (Math.abs(total - maxScore) > 0.001) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Tổng điểm câu hỏi phải bằng điểm tối đa.",
      { questionTotal: total, maxScore },
    );
  }
}

async function purgeUnusedAsset(
  tx: TransactionClient,
  assetId: string | null | undefined,
  cleanupTargets: CleanupTarget[],
) {
  if (!assetId) return;

  const asset = await tx.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      storageKey: true,
      _count: {
        select: {
          recordingSources: true,
          recordingThumbnails: true,
          materials: true,
          submissionFiles: true,
          reports: true,
        },
      },
    },
  });

  if (!asset) return;

  const stillUsed =
    asset._count.recordingSources > 0 ||
    asset._count.recordingThumbnails > 0 ||
    asset._count.materials > 0 ||
    asset._count.submissionFiles > 0 ||
    asset._count.reports > 0;

  if (stillUsed) return;

  await tx.asset.delete({
    where: { id: asset.id },
  });

  cleanupTargets.push({
    storageKey: asset.storageKey,
  });
}

export async function purgeContent(
  actor: Actor,
  contentId: string,
  reason: string,
  context?: RequestContext,
) {
  if (actor.role !== "ADMIN") {
    throw new AppError(
      "FORBIDDEN",
      "Chỉ quản trị viên được phép xóa vĩnh viễn nội dung.",
    );
  }

  return prisma.$transaction(
    async (tx) => {
      // Khóa record trong thời gian purge
      await tx.$queryRaw`
        SELECT "id"
        FROM "contents"
        WHERE "id" = ${contentId}::uuid
        FOR UPDATE
      `;

      const content = await tx.content.findUnique({
        where: { id: contentId },
        include: {
          nextVersion: {
            select: { id: true },
          },
          lesson: {
            select: { id: true },
          },
          material: {
            select: {
              id: true,
              assetId: true,
              previewStorageKey: true,

              asset: {
                select: {
                  storageKey: true,
                },
              },
            },
          },
          recording: {
            select: {
              id: true,
              assetId: true,
              thumbnailAssetId: true,
              hlsManifestKey: true,
            },
          },
          assignment: {
            select: {
              id: true,
            },
          },
          quiz: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!content) {
        throw new AppError("NOT_FOUND");
      }

      /*
       * Nếu version này đang là cha của version mới hơn thì không xóa,
       * tránh phá chuỗi version.
       */
      if (content.nextVersion) {
        throw new AppError(
          "CONFLICT",
          "Nội dung này có phiên bản mới hơn. Hãy xóa phiên bản mới nhất trước.",
        );
      }

      const cleanupTargets: CleanupTarget[] = [];
      const candidateAssetIds = new Set<string>();

      /*
       * ============================================================
       * VIDEO
       * ============================================================
       */

      if (content.recording) {
        const recording = content.recording;

        candidateAssetIds.add(recording.assetId);

        if (recording.thumbnailAssetId) {
          candidateAssetIds.add(recording.thumbnailAssetId);
        }

        // Xóa lịch sử xem video
        await tx.videoProgress.deleteMany({
          where: {
            recordingId: recording.id,
          },
        });

        await tx.videoViewSession.deleteMany({
          where: {
            recordingId: recording.id,
          },
        });

        /*
         * Xóa các job xử lý video cũ.
         *
         * Dùng executeRaw, không dùng queryRaw vì đây là DELETE.
         */
        await tx.$executeRaw`
          DELETE FROM "jobs"
          WHERE "payload"->>'recordingId' = ${recording.id}
            AND "type"::text IN (
              'PROCESS_VIDEO',
              'CREATE_THUMBNAIL',
              'GENERATE_HLS'
            )
        `;

        await tx.recording.delete({
          where: {
            id: recording.id,
          },
        });

        /*
         * HLS không phải Asset.
         *
         * Chỉ xóa thư mục HLS nếu không còn Recording nào khác
         * tham chiếu cùng manifest.
         */
        if (recording.hlsManifestKey) {
          const remaining = await tx.recording.count({
            where: {
              hlsManifestKey: recording.hlsManifestKey,
            },
          });

          if (remaining === 0) {
            const slashIndex = recording.hlsManifestKey.lastIndexOf("/");

            if (slashIndex > 0) {
              cleanupTargets.push({
                storageKey: recording.hlsManifestKey.slice(0, slashIndex),
                recursive: true,
              });
            }
          }
        }
      }

      /*
       * ============================================================
       * MATERIAL
       * ============================================================
       */

      if (content.material) {
        candidateAssetIds.add(content.material.assetId);
        await tx.$executeRaw`
  DELETE FROM "jobs"
  WHERE "payload"->>'materialId' =
        ${content.material.id}
    AND "type"::text =
        'GENERATE_DOCUMENT_PREVIEW'
`;

        if (
          content.material.previewStorageKey &&
          content.material.previewStorageKey !==
            content.material.asset.storageKey
        ) {
          const remainingPreviewReferences = await tx.material.count({
            where: {
              id: {
                not: content.material.id,
              },

              previewStorageKey: content.material.previewStorageKey,
            },
          });

          if (remainingPreviewReferences === 0) {
            cleanupTargets.push({
              storageKey: content.material.previewStorageKey,
            });
          }
        }
        candidateAssetIds.add(content.material.assetId);
        await tx.material.delete({
          where: {
            id: content.material.id,
          },
        });
      }

      /*
       * ============================================================
       * ASSIGNMENT
       * ============================================================
       */

      if (content.assignment) {
        const assignmentId = content.assignment.id;

        /*
         * Lấy asset của file học sinh nộp trước khi xóa relation.
         */
        const submissionFiles = await tx.submissionFile.findMany({
          where: {
            submission: {
              assignmentId,
            },
          },
          select: {
            assetId: true,
          },
        });

        for (const file of submissionFiles) {
          candidateAssetIds.add(file.assetId);
        }

        /*
         * SubmissionFile dùng Restrict nên phải xóa trước Submission.
         */
        await tx.submissionFile.deleteMany({
          where: {
            submission: {
              assignmentId,
            },
          },
        });

        /*
         * SubmissionAnswer sẽ cascade khi Submission bị xóa.
         */
        await tx.submission.deleteMany({
          where: {
            assignmentId,
          },
        });

        /*
         * Question/Choice dùng Cascade từ Assignment.
         */
        await tx.assignment.delete({
          where: {
            id: assignmentId,
          },
        });
      }

      /*
       * ============================================================
       * QUIZ
       * ============================================================
       */

      if (content.quiz) {
        const quizId = content.quiz.id;

        /*
         * QuizAnswer cascade theo QuizAttempt.
         */
        await tx.quizAttempt.deleteMany({
          where: {
            quizId,
          },
        });

        /*
         * Question/Choice cascade khi Quiz bị xóa.
         */
        await tx.quiz.delete({
          where: {
            id: quizId,
          },
        });
      }

      /*
       * ============================================================
       * LESSON
       * ============================================================
       */

      if (content.lesson) {
        await tx.lesson.delete({
          where: {
            id: content.lesson.id,
          },
        });
      }

      /*
       * ============================================================
       * WORKFLOW DATA
       * ============================================================
       */

      await tx.contentReview.deleteMany({
        where: {
          contentId,
        },
      });

      await tx.contentReopenRequest.deleteMany({
        where: {
          contentId,
        },
      });

      /*
       * Audit trước khi xóa Content.
       *
       * AuditLog không có FK về Content nên có thể giữ lại
       * để biết ai đã xóa cái gì.
       */
      await writeAuditLog(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action: "CONTENT_PERMANENTLY_DELETED",
        entityType: "Content",
        entityId: content.id,
        oldValue: {
          id: content.id,
          classId: content.classId,
          classSessionId: content.classSessionId,
          creatorId: content.creatorId,
          creatorRole: content.creatorRole,
          type: content.type,
          title: content.title,
          description: content.description,
          publicationStatus: content.publicationStatus,
          version: content.version,
          previousVersionId: content.previousVersionId,
          publishedAt: content.publishedAt,
          createdAt: content.createdAt,
        },
        reason,
        context,
      });

      /*
       * ============================================================
       * CONTENT
       * ============================================================
       */

      await tx.content.delete({
        where: {
          id: content.id,
        },
      });

      /*
       * ============================================================
       * ASSETS
       * ============================================================
       *
       * Asset có thể được nhiều version dùng chung.
       * Chỉ xóa Asset khi không còn relation nào sử dụng.
       */

      for (const assetId of candidateAssetIds) {
        await purgeUnusedAsset(tx, assetId, cleanupTargets);
      }

      /*
       * Không xóa file trực tiếp trong transaction DB.
       *
       * Tạo job để worker xóa file sau khi transaction commit.
       * Như vậy database không bị rollback sau khi file đã biến mất.
       */

      for (const target of cleanupTargets) {
        await tx.job.create({
          data: {
            type: "DELETE_FILE",
            payload: {
              storageKey: target.storageKey,
              recursive: target.recursive ?? false,
            },
          },
        });
      }

      return {
        id: content.id,
        title: content.title,
        deleted: true,
        cleanupQueued: cleanupTargets.length,
      };
    },
    {
      isolationLevel: "Serializable",
    },
  );
}

export async function createContent(
  actor: Actor,
  input: CreateContentInput,
  context?: RequestContext,
) {
  if (
    !["ADMIN", "MANAGER", "TEACHER", "TEACHING_ASSISTANT"].includes(actor.role)
  ) {
    throw new AppError("FORBIDDEN");
  }
  await assertStaffClassAccess(actor, input.classId);

  const classSession = await prisma.classSession.findFirst({
    where: {
      id: input.classSessionId,
      classId: input.classId,
      status: { not: "CANCELLED" },
    },
    select: { id: true },
  });
  if (!classSession) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Buổi học không thuộc lớp hoặc đã bị hủy.",
    );
  }

  if (input.type === "ASSIGNMENT" || input.type === "QUIZ") {
    assertQuestionScore(input.payload.questions, input.payload.maxScore);
  }

  return prisma.$transaction(async (tx) => {
    const content = await tx.content.create({
      data: {
        classId: input.classId,
        classSessionId: input.classSessionId,
        creatorId: actor.id,
        creatorRole: actor.role,
        type: input.type,
        title: input.title,
        description: input.description,
      },
    });

    switch (input.type) {
      case "LESSON":
        await tx.lesson.create({
          data: {
            contentId: content.id,
            markdownContent: input.payload.markdownContent,
            learningObjectives: input.payload.learningObjectives,
          },
        });
        break;
      case "MATERIAL": {
        const asset = await tx.asset.findFirst({
          where: {
            id: input.payload.assetId,
            category: "DOCUMENT",
            status: "READY",
            deletedAt: null,
          },
        });
        if (!asset) {
          throw new AppError(
            "VALIDATION_ERROR",
            "Tài liệu đã tải lên không hợp lệ.",
          );
        }
        const preview = materialPreviewPlan(asset.mimeType, asset.storageKey);

        const material = await tx.material.create({
          data: {
            contentId: content.id,
            assetId: asset.id,
            title: input.payload.title,
            description: input.payload.description,
            mimeType: asset.mimeType,
            sizeBytes: asset.sizeBytes,

            previewStatus: preview.previewStatus,

            previewStorageKey: preview.previewStorageKey,

            previewError: preview.previewError,
          },
        });

        if (preview.needsConversion) {
          await tx.job.create({
            data: {
              type: "GENERATE_DOCUMENT_PREVIEW",
              payload: {
                materialId: material.id,
              },
            },
          });
        }
        break;
      }
      case "VIDEO": {
        const asset = await tx.asset.findFirst({
          where: {
            id: input.payload.assetId,
            category: { in: ["RECORDING", "TEMP"] },
            status: "READY",
            deletedAt: null,
          },
        });
        if (!asset) {
          throw new AppError(
            "VALIDATION_ERROR",
            "File video đã tải lên không hợp lệ.",
          );
        }
        const recording = await tx.recording.create({
          data: {
            contentId: content.id,
            assetId: asset.id,
            processingStatus: "PROCESSING",
          },
        });
        await tx.job.create({
          data: {
            type: "PROCESS_VIDEO",
            payload: {
              recordingId: recording.id,
            },
          },
        });
        break;
      }
      case "ASSIGNMENT":
        await tx.assignment.create({
          data: {
            contentId: content.id,
            opensAt: input.payload.opensAt,
            dueAt: input.payload.dueAt,
            allowLateSubmission: input.payload.allowLateSubmission,
            maxAttempts: input.payload.maxAttempts,
            maxScore: input.payload.maxScore,
            questions: {
              create: input.payload.questions.map((question) => ({
                type: question.type,
                content: question.content,
                order: question.order,
                score: question.score,
                explanation: question.explanation,
                required: question.required,
                choices: {
                  create: question.choices.map((choice) => ({
                    content: choice.content,
                    isCorrect: choice.isCorrect,
                    order: choice.order,
                  })),
                },
              })),
            },
          },
        });
        break;
      case "QUIZ":
        await tx.quiz.create({
          data: {
            contentId: content.id,
            opensAt: input.payload.opensAt,
            closesAt: input.payload.closesAt,
            durationMinutes: input.payload.durationMinutes,
            maxAttempts: input.payload.maxAttempts,
            shuffleQuestions: input.payload.shuffleQuestions,
            shuffleChoices: input.payload.shuffleChoices,
            showResultAt: input.payload.showResultAt,
            showCorrectAnswersAt: input.payload.showCorrectAnswersAt,
            maxScore: input.payload.maxScore,
            questions: {
              create: input.payload.questions.map((question) => ({
                type: question.type,
                content: question.content,
                order: question.order,
                score: question.score,
                explanation: question.explanation,
                required: question.required,
                choices: {
                  create: question.choices.map((choice) => ({
                    content: choice.content,
                    isCorrect: choice.isCorrect,
                    order: choice.order,
                  })),
                },
              })),
            },
          },
        });
        break;
    }

    await writeAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      action: "CONTENT_CREATED",
      entityType: "Content",
      entityId: content.id,
      newValue: content,
      context,
    });
    return content;
  });
}

export async function getContentDetail(actor: Actor, contentId: string) {
  const content = await findContentForWorkflow(contentId);
  if (!content) throw new AppError("NOT_FOUND");
  await assertClassAccess(actor, content.classId);
  const isLearner = actor.role === "STUDENT" || actor.role === "PARENT";
  if (isLearner && content.publicationStatus !== "PUBLISHED") {
    throw new AppError("FORBIDDEN");
  }

  const questions = (
    source:
      | NonNullable<typeof content.assignment>["questions"]
      | NonNullable<typeof content.quiz>["questions"],
  ) =>
    source.map((question) => ({
      id: question.id,
      type: question.type,
      content: question.content,
      order: question.order,
      score: question.score,
      required: question.required,
      ...(!isLearner ? { explanation: question.explanation } : {}),
      choices: question.choices.map((choice) => ({
        id: choice.id,
        content: choice.content,
        order: choice.order,
        ...(!isLearner ? { isCorrect: choice.isCorrect } : {}),
      })),
    }));

  return {
    id: content.id,
    classId: content.classId,
    classSessionId: content.classSessionId,
    type: content.type,
    title: content.title,
    description: content.description,
    creatorId: content.creatorId,
    creatorRole: content.creatorRole,
    creator: content.creator,
    courseClass: content.courseClass,
    classSession: content.classSession,
    publicationStatus: content.publicationStatus,
    version: content.version,
    previousVersionId: content.previousVersionId,
    publishedAt: content.publishedAt,
    updatedAt: content.updatedAt,
    reviews: isLearner
      ? []
      : content.reviews.map((review) => ({
          id: review.id,
          action: review.action,
          comment: review.comment,
          createdAt: review.createdAt,
          reviewer: review.reviewer,
        })),
    payload:
      content.type === "LESSON" && content.lesson
        ? {
            markdownContent: content.lesson.markdownContent,
            learningObjectives: content.lesson.learningObjectives,
          }
        : content.type === "MATERIAL" && content.material
          ? {
              materialId: content.material.id,

              assetId: content.material.assetId,

              title: content.material.title,

              description: content.material.description,

              mimeType: content.material.mimeType,

              sizeBytes: content.material.sizeBytes.toString(),

              previewStatus: content.material.previewStatus,

              previewError: isLearner
                ? undefined
                : content.material.previewError,

              viewUrl:
                content.material.previewStatus === "READY" &&
                content.material.previewStorageKey
                  ? `/api/v1/materials/${content.material.id}/preview`
                  : null,

              ...(!isLearner
                ? {
                    downloadUrl: `/api/v1/assets/${content.material.assetId}/download`,
                  }
                : {}),
            }
          : content.type === "VIDEO" && content.recording
            ? {
                assetId: content.recording.assetId,
                recordingId: content.recording.id,
                processingStatus: content.recording.processingStatus,
                durationSeconds: content.recording.durationSeconds,
                width: content.recording.width,
                height: content.recording.height,
                authorizeUrl: `/api/v1/videos/${content.recording.id}/authorize`,
              }
            : content.type === "ASSIGNMENT" && content.assignment
              ? {
                  opensAt: content.assignment.opensAt,
                  dueAt: content.assignment.dueAt,
                  allowLateSubmission: content.assignment.allowLateSubmission,
                  maxAttempts: content.assignment.maxAttempts,
                  maxScore: content.assignment.maxScore,
                  questions: questions(content.assignment.questions),
                }
              : content.type === "QUIZ" && content.quiz
                ? {
                    opensAt: content.quiz.opensAt,
                    closesAt: content.quiz.closesAt,
                    durationMinutes: content.quiz.durationMinutes,
                    maxAttempts: content.quiz.maxAttempts,
                    shuffleQuestions: content.quiz.shuffleQuestions,
                    shuffleChoices: content.quiz.shuffleChoices,
                    showResultAt: content.quiz.showResultAt,
                    showCorrectAnswersAt: content.quiz.showCorrectAnswersAt,
                    maxScore: content.quiz.maxScore,
                    questions: questions(content.quiz.questions),
                  }
                : null,
  };
}

export async function updateContent(
  actor: Actor,
  contentId: string,
  input: UpdateContentInput,
  context?: RequestContext,
) {
  const initial = await findContentForWorkflow(contentId);
  if (!initial) throw new AppError("NOT_FOUND");
  await assertStaffClassAccess(actor, initial.classId);
  if (!canEditContent(actor, initial)) throw new AppError("FORBIDDEN");
  if (
    input.classId !== initial.classId ||
    input.classSessionId !== initial.classSessionId ||
    input.type !== initial.type
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Không thể đổi lớp, buổi học hoặc loại của content hiện có.",
    );
  }
  if (input.type === "ASSIGNMENT" || input.type === "QUIZ") {
    assertQuestionScore(input.payload.questions, input.payload.maxScore);
  }

  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "contents" WHERE "id" = ${contentId}::uuid FOR UPDATE`;
      const current = await tx.content.findUnique({
        where: { id: contentId, deletedAt: null },
        include: contentRelations,
      });
      if (!current) throw new AppError("NOT_FOUND");
      if (!canEditContent(actor, current)) throw new AppError("FORBIDDEN");
      if (current.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
        throw new AppError(
          "CONFLICT",
          "Nội dung đã được người khác cập nhật. Vui lòng tải lại.",
        );
      }

      if (input.type === "LESSON") {
        await tx.lesson.update({
          where: { contentId },
          data: {
            markdownContent: input.payload.markdownContent,
            learningObjectives: input.payload.learningObjectives,
          },
        });
      } else if (input.type === "MATERIAL") {
        const asset = await tx.asset.findFirst({
          where: {
            id: input.payload.assetId,
            category: "DOCUMENT",
            status: "READY",
            deletedAt: null,
          },
        });
        if (!asset) {
          throw new AppError("VALIDATION_ERROR", "Tài liệu không hợp lệ.");
        }
        const assetChanged = current.material?.assetId !== asset.id;

        const preview = materialPreviewPlan(asset.mimeType, asset.storageKey);

        const material = await tx.material.update({
          where: {
            contentId,
          },
          data: {
            assetId: asset.id,
            title: input.payload.title,
            description: input.payload.description,
            mimeType: asset.mimeType,
            sizeBytes: asset.sizeBytes,

            ...(assetChanged
              ? {
                  previewStatus: preview.previewStatus,

                  previewStorageKey: preview.previewStorageKey,

                  previewError: null,
                }
              : {}),
          },
        });

        if (assetChanged && preview.needsConversion) {
          await tx.job.create({
            data: {
              type: "GENERATE_DOCUMENT_PREVIEW",
              payload: {
                materialId: material.id,
              },
            },
          });
        }
      } else if (input.type === "VIDEO") {
        const asset = await tx.asset.findFirst({
          where: {
            id: input.payload.assetId,
            category: { in: ["RECORDING", "TEMP"] },
            status: "READY",
            deletedAt: null,
          },
        });
        if (!asset) {
          throw new AppError("VALIDATION_ERROR", "File video không hợp lệ.");
        }
        if (current.recording?.assetId !== asset.id) {
          const recording = await tx.recording.update({
            where: { contentId },
            data: {
              assetId: asset.id,
              thumbnailAssetId: null,
              hlsManifestKey: null,
              processingStatus: "PROCESSING",
              durationSeconds: null,
              width: null,
              height: null,
              codec: null,
              errorMessage: null,
            },
          });
          await tx.job.create({
            data: {
              type: "PROCESS_VIDEO",
              payload: { recordingId: recording.id },
            },
          });
        }
      } else if (input.type === "ASSIGNMENT") {
        const submissionCount = await tx.submission.count({
          where: { assignment: { contentId } },
        });
        if (submissionCount > 0) {
          throw new AppError(
            "CONFLICT",
            "Không thể thay cấu trúc bài tập đã có lượt làm.",
          );
        }
        await tx.assignment.update({
          where: { contentId },
          data: {
            opensAt: input.payload.opensAt,
            dueAt: input.payload.dueAt,
            allowLateSubmission: input.payload.allowLateSubmission,
            maxAttempts: input.payload.maxAttempts,
            maxScore: input.payload.maxScore,
            questions: {
              deleteMany: {},
              create: input.payload.questions.map((question) => ({
                type: question.type,
                content: question.content,
                order: question.order,
                score: question.score,
                explanation: question.explanation,
                required: question.required,
                choices: {
                  create: question.choices.map((choice) => ({
                    content: choice.content,
                    isCorrect: choice.isCorrect,
                    order: choice.order,
                  })),
                },
              })),
            },
          },
        });
      } else {
        const attemptCount = await tx.quizAttempt.count({
          where: { quiz: { contentId } },
        });
        if (attemptCount > 0) {
          throw new AppError(
            "CONFLICT",
            "Không thể thay cấu trúc quiz đã có lượt làm.",
          );
        }
        await tx.quiz.update({
          where: { contentId },
          data: {
            opensAt: input.payload.opensAt,
            closesAt: input.payload.closesAt,
            durationMinutes: input.payload.durationMinutes,
            maxAttempts: input.payload.maxAttempts,
            shuffleQuestions: input.payload.shuffleQuestions,
            shuffleChoices: input.payload.shuffleChoices,
            showResultAt: input.payload.showResultAt,
            showCorrectAnswersAt: input.payload.showCorrectAnswersAt,
            maxScore: input.payload.maxScore,
            questions: {
              deleteMany: {},
              create: input.payload.questions.map((question) => ({
                type: question.type,
                content: question.content,
                order: question.order,
                score: question.score,
                explanation: question.explanation,
                required: question.required,
                choices: {
                  create: question.choices.map((choice) => ({
                    content: choice.content,
                    isCorrect: choice.isCorrect,
                    order: choice.order,
                  })),
                },
              })),
            },
          },
        });
      }

      const updated = await tx.content.update({
        where: { id: contentId },
        data: { title: input.title, description: input.description },
      });
      await writeAuditLog(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action: "CONTENT_UPDATED",
        entityType: "Content",
        entityId: contentId,
        oldValue: current,
        newValue: updated,
        reason: input.reason,
        context,
      });
      return updated;
    },
    { isolationLevel: "Serializable" },
  );
}

function validateWorkflowInput(input: WorkflowInput) {
  if (
    ["REQUEST_CHANGES", "REJECT"].includes(input.action) &&
    !input.comment?.trim()
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Vui lòng nhập nhận xét cho quyết định duyệt.",
    );
  }
  if (
    ["REQUEST_REOPEN", "REOPEN", "REJECT_REOPEN", "HIDE", "ARCHIVE"].includes(
      input.action,
    ) &&
    !input.reason?.trim()
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Vui lòng nhập lý do cho thao tác này.",
    );
  }
}

function assertContentReady(
  content: NonNullable<Awaited<ReturnType<typeof findContentForWorkflow>>>,
) {
  const ready =
    (content.type === "LESSON" &&
      Boolean(content.lesson?.markdownContent.trim())) ||
    (content.type === "MATERIAL" &&
      content.material?.previewStatus === "READY" &&
      Boolean(content.material.previewStorageKey)) ||
    (content.type === "VIDEO" &&
      content.recording?.processingStatus === "READY") ||
    (content.type === "ASSIGNMENT" &&
      Boolean(content.assignment?.questions.length)) ||
    (content.type === "QUIZ" && Boolean(content.quiz?.questions.length));

  if (!ready) {
    throw new AppError(
      "CONFLICT",
      "Nội dung chưa đủ dữ liệu hoặc tài nguyên chưa xử lý xong.",
    );
  }
}

async function cloneContentVersion(
  tx: TransactionClient,
  source: NonNullable<Awaited<ReturnType<typeof findContentForWorkflow>>>,
  actor: Actor,
) {
  const next = await tx.content.create({
    data: {
      classId: source.classId,
      classSessionId: source.classSessionId,
      creatorId: source.creatorId,
      creatorRole: source.creatorRole,
      type: source.type,
      title: source.title,
      description: source.description,
      publicationStatus: "REOPENED",
      version: source.version + 1,
      previousVersionId: source.id,
      reopenedById: actor.id,
      reopenedAt: new Date(),
    },
  });

  if (source.lesson) {
    await tx.lesson.create({
      data: {
        contentId: next.id,
        markdownContent: source.lesson.markdownContent,
        learningObjectives: source.lesson.learningObjectives,
      },
    });
  }

  if (source.material) {
    await tx.material.create({
      data: {
        contentId: next.id,
        assetId: source.material.assetId,
        title: source.material.title,
        description: source.material.description,
        mimeType: source.material.mimeType,
        sizeBytes: source.material.sizeBytes,

        previewStatus: source.material.previewStatus,

        previewStorageKey: source.material.previewStorageKey,

        previewError: source.material.previewError,
      },
    });
  }

  if (source.recording) {
    await tx.recording.create({
      data: {
        contentId: next.id,
        assetId: source.recording.assetId,
        thumbnailAssetId: source.recording.thumbnailAssetId,
        hlsManifestKey: source.recording.hlsManifestKey,
        processingStatus: source.recording.processingStatus,
        durationSeconds: source.recording.durationSeconds,
        width: source.recording.width,
        height: source.recording.height,
        codec: source.recording.codec,
        errorMessage: source.recording.errorMessage,
      },
    });
  }

  if (source.assignment) {
    await tx.assignment.create({
      data: {
        contentId: next.id,
        opensAt: source.assignment.opensAt,
        dueAt: source.assignment.dueAt,
        allowLateSubmission: source.assignment.allowLateSubmission,
        maxAttempts: source.assignment.maxAttempts,
        maxScore: source.assignment.maxScore,
        questions: {
          create: source.assignment.questions.map((question) => ({
            type: question.type,
            content: question.content,
            order: question.order,
            score: question.score,
            explanation: question.explanation,
            required: question.required,
            choices: {
              create: question.choices.map((choice) => ({
                content: choice.content,
                isCorrect: choice.isCorrect,
                order: choice.order,
              })),
            },
          })),
        },
      },
    });
  }

  if (source.quiz) {
    await tx.quiz.create({
      data: {
        contentId: next.id,
        opensAt: source.quiz.opensAt,
        closesAt: source.quiz.closesAt,
        durationMinutes: source.quiz.durationMinutes,
        maxAttempts: source.quiz.maxAttempts,
        shuffleQuestions: source.quiz.shuffleQuestions,
        shuffleChoices: source.quiz.shuffleChoices,
        showResultAt: source.quiz.showResultAt,
        showCorrectAnswersAt: source.quiz.showCorrectAnswersAt,
        maxScore: source.quiz.maxScore,
        questions: {
          create: source.quiz.questions.map((question) => ({
            type: question.type,
            content: question.content,
            order: question.order,
            score: question.score,
            explanation: question.explanation,
            required: question.required,
            choices: {
              create: question.choices.map((choice) => ({
                content: choice.content,
                isCorrect: choice.isCorrect,
                order: choice.order,
              })),
            },
          })),
        },
      },
    });
  }

  return next;
}

export async function executeContentWorkflow(
  actor: Actor,
  contentId: string,
  input: WorkflowInput,
  context?: RequestContext,
) {
  validateWorkflowInput(input);

  const initial = await findContentForWorkflow(contentId);
  if (!initial) throw new AppError("NOT_FOUND");
  await assertStaffClassAccess(actor, initial.classId);

  return prisma.$transaction(
    async (tx) => {
      const content = await tx.content.findUnique({
        where: { id: contentId, deletedAt: null },
        include: contentRelations,
      });
      if (!content) throw new AppError("NOT_FOUND");

      const nextStatus = resolveContentTransition(actor, content, input.action);
      if (input.action === "PUBLISH" || input.action === "SUBMIT_REVIEW") {
        assertContentReady(
          content as NonNullable<
            Awaited<ReturnType<typeof findContentForWorkflow>>
          >,
        );
      }
      const now = new Date();

      if (input.action === "REQUEST_REOPEN") {
        const existing = await tx.contentReopenRequest.findFirst({
          where: { contentId, status: "PENDING" },
          select: { id: true },
        });
        if (existing) {
          throw new AppError(
            "CONFLICT",
            "Nội dung đã có một yêu cầu mở lại đang chờ xử lý.",
          );
        }

        await tx.contentReopenRequest.create({
          data: {
            contentId,
            requestedById: actor.id,
            reason: input.reason!,
          },
        });
      }

      if (input.action === "REOPEN") {
        const pendingRequest = await tx.contentReopenRequest.findFirst({
          where: { contentId, status: "PENDING" },
          orderBy: { createdAt: "desc" },
        });
        if (!pendingRequest) {
          throw new AppError(
            "CONFLICT",
            "Không có yêu cầu mở lại đang chờ xử lý.",
          );
        }

        const newVersion = await cloneContentVersion(
          tx,
          content as NonNullable<
            Awaited<ReturnType<typeof findContentForWorkflow>>
          >,
          actor,
        );
        await tx.content.update({
          where: { id: content.id },
          data: { publicationStatus: "PUBLISHED" },
        });
        await tx.contentReopenRequest.update({
          where: { id: pendingRequest.id },
          data: {
            status: "APPROVED",
            resolvedById: actor.id,
            resolvedAt: now,
            resolutionComment: input.reason,
          },
        });
        await writeAuditLog(tx, {
          actorId: actor.id,
          actorRole: actor.role,
          action: "CONTENT_REOPEN_APPROVED",
          entityType: "Content",
          entityId: newVersion.id,
          oldValue: content,
          newValue: newVersion,
          reason: input.reason,
          context,
        });
        return newVersion;
      }

      if (input.action === "REJECT_REOPEN") {
        const pendingRequest = await tx.contentReopenRequest.findFirst({
          where: { contentId, status: "PENDING" },
          orderBy: { createdAt: "desc" },
        });
        if (!pendingRequest) {
          throw new AppError(
            "CONFLICT",
            "Không có yêu cầu mở lại đang chờ xử lý.",
          );
        }
        await tx.contentReopenRequest.update({
          where: { id: pendingRequest.id },
          data: {
            status: "REJECTED",
            resolvedById: actor.id,
            resolvedAt: now,
            resolutionComment: input.reason,
          },
        });
      }

      const reviewAction = {
        SUBMIT_REVIEW: "SUBMITTED",
        APPROVE: "APPROVED",
        REQUEST_CHANGES: "CHANGES_REQUESTED",
        REJECT: "REJECTED",
      } as const;

      if (input.action in reviewAction) {
        await tx.contentReview.create({
          data: {
            contentId,
            reviewerId: actor.id,
            action: reviewAction[input.action as keyof typeof reviewAction],
            comment: input.comment,
          },
        });
      }

      const updated = await tx.content.update({
        where: { id: contentId },
        data: {
          publicationStatus: nextStatus,
          ...(input.action === "APPROVE"
            ? { approvedById: actor.id, approvedAt: now }
            : {}),
          ...(input.action === "REQUEST_CHANGES" || input.action === "REJECT"
            ? { approvedById: null, approvedAt: null }
            : {}),
          ...(input.action === "PUBLISH"
            ? {
                publishedById: actor.id,
                publishedAt: now,
                lockedAt: now,
              }
            : {}),
          ...(input.action === "ARCHIVE" ? { archivedAt: now } : {}),
        },
      });

      if (input.action === "PUBLISH" && content.previousVersionId) {
        await tx.content.update({
          where: { id: content.previousVersionId },
          data: {
            publicationStatus: "ARCHIVED",
            archivedAt: now,
          },
        });
      }

      await writeAuditLog(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        action: `CONTENT_${input.action}`,
        entityType: "Content",
        entityId: contentId,
        oldValue: content,
        newValue: updated,
        reason: input.reason ?? input.comment,
        context,
      });

      return updated;
    },
    {
      isolationLevel: "Serializable",
    },
  );
}
