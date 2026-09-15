import type { Prisma } from "@/generated/prisma/client";
import type { JobType } from "@/generated/prisma/enums";
import { env } from "@/config/env";
import { disconnectDatabase, prisma } from "@/lib/database/client";
import { logger } from "@/lib/logger";

import { processJob } from "./process";

type ClaimedJob = {
  id: string;
  type: JobType;
  payload: Prisma.JsonValue;
  attempts: number;
  maxAttempts: number;
};

let stopping = false;
let lastScheduleAt = 0;
let lastMaterialPreviewScheduleAt = 0;

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function recoverStaleJobs() {
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000);
  const count = await prisma.$executeRaw`
    UPDATE "jobs"
    SET
      "status" = CASE
        WHEN "attempts" >= "maxAttempts" THEN 'FAILED'::"JobStatus"
        ELSE 'PENDING'::"JobStatus"
      END,
      "scheduledAt" = NOW(),
      "completedAt" = CASE
        WHEN "attempts" >= "maxAttempts" THEN NOW()
        ELSE NULL
      END,
      "lockedAt" = NULL,
      "lockedBy" = NULL,
      "errorMessage" = 'Worker trước đó không hoàn tất; job đã được thu hồi.',
      "updatedAt" = NOW()
    WHERE "status" = 'PROCESSING'::"JobStatus"
      AND "lockedAt" < ${staleBefore}
  `;
  if (count) logger.warn({ count }, "Recovered stale jobs");
}

async function scheduleAttendanceJobs() {
  if (Date.now() - lastScheduleAt < 60_000) return;
  lastScheduleAt = Date.now();
  const sessions = await prisma.classSession.findMany({
    where: {
      endAt: { lte: new Date() },
      status: { in: ["SCHEDULED", "ONGOING"] },
    },
    select: { id: true },
    take: 100,
  });
  for (const session of sessions) {
    const existing = await prisma.job.findFirst({
      where: {
        type: "FINALIZE_ATTENDANCE",
        payload: { path: ["sessionId"], equals: session.id },
        status: { in: ["PENDING", "PROCESSING", "COMPLETED"] },
      },
      select: { id: true },
    });
    if (!existing) {
      await prisma.job.create({
        data: {
          type: "FINALIZE_ATTENDANCE",
          payload: { sessionId: session.id },
        },
      });
    }
  }
  await finalizeExpiredQuizAttempts();
  await prisma.videoViewSession.updateMany({
    where: {
      status: "ACTIVE",
      lastSeenAt: { lt: new Date(Date.now() - 90_000) },
    },
    data: { status: "ENDED", endedAt: new Date() },
  });
}

async function scheduleMaterialPreviewJobs() {
  if (Date.now() - lastMaterialPreviewScheduleAt < 60_000) {
    return;
  }

  lastMaterialPreviewScheduleAt = Date.now();

  const materials = await prisma.material.findMany({
    where: {
      previewStatus: "PENDING",
    },
    select: {
      id: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 50,
  });

  for (const material of materials) {
    const existing = await prisma.job.findFirst({
      where: {
        type: "GENERATE_DOCUMENT_PREVIEW",

        payload: {
          path: ["materialId"],
          equals: material.id,
        },

        status: {
          in: ["PENDING", "PROCESSING"],
        },
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      await prisma.job.create({
        data: {
          type: "GENERATE_DOCUMENT_PREVIEW",

          payload: {
            materialId: material.id,
          },
        },
      });
    }
  }
}

async function finalizeExpiredQuizAttempts() {
  const attempts = await prisma.quizAttempt.findMany({
    where: { status: "IN_PROGRESS", expiresAt: { lte: new Date() } },
    include: {
      answers: true,
      quiz: {
        include: { questions: { include: { choices: true } } },
      },
    },
    orderBy: { expiresAt: "asc" },
    take: 100,
  });

  for (const attempt of attempts) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.quizAttempt.findUnique({
        where: { id: attempt.id },
        select: { status: true },
      });
      if (current?.status !== "IN_PROGRESS") return;

      const answers = new Map(
        attempt.answers.map((answer) => [answer.questionId, answer]),
      );
      let autoScore = 0;
      let requiresManualGrading = false;
      for (const question of attempt.quiz.questions) {
        const answer = answers.get(question.id);
        if (!["SINGLE_CHOICE", "TRUE_FALSE"].includes(question.type)) {
          requiresManualGrading = true;
          continue;
        }
        const selected = new Set(
          Array.isArray(answer?.selectedChoiceIds)
            ? (answer.selectedChoiceIds as string[])
            : [],
        );
        const correct = new Set(
          question.choices
            .filter((choice) => choice.isCorrect)
            .map((choice) => choice.id),
        );
        const score =
          selected.size === correct.size &&
          [...selected].every((id) => correct.has(id))
            ? question.score.toNumber()
            : 0;
        autoScore += score;
        if (answer) {
          await tx.quizAnswer.update({
            where: { id: answer.id },
            data: { autoScore: score },
          });
        }
      }
      const updated = await tx.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          status: requiresManualGrading ? "GRADING" : "GRADED",
          submittedAt: new Date(),
          autoScore,
          finalScore: requiresManualGrading ? null : autoScore,
        },
      });
      await tx.auditLog.create({
        data: {
          actorRole: "ADMIN",
          action: "QUIZ_ATTEMPT_AUTO_SUBMITTED",
          entityType: "QuizAttempt",
          entityId: attempt.id,
          newValue: {
            status: updated.status,
            submittedAt: updated.submittedAt?.toISOString(),
            autoScore,
          },
          reason: "Worker tự động nộp khi hết giờ máy chủ.",
        },
      });
    });
  }
}

async function claimJob() {
  return prisma.$transaction(async (tx) => {
    const jobs = await tx.$queryRaw<ClaimedJob[]>`
      UPDATE "jobs"
      SET
        "status" = 'PROCESSING'::"JobStatus",
        "attempts" = "attempts" + 1,
        "startedAt" = NOW(),
        "lockedAt" = NOW(),
        "lockedBy" = ${env.WORKER_ID},
        "updatedAt" = NOW()
      WHERE "id" = (
        SELECT "id"
        FROM "jobs"
        WHERE "status" = 'PENDING'::"JobStatus"
          AND "scheduledAt" <= NOW()
        ORDER BY "scheduledAt" ASC, "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING "id", "type", "payload", "attempts", "maxAttempts"
    `;
    return jobs[0] ?? null;
  });
}

async function completeJob(jobId: string, result: unknown) {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      result: result as Prisma.InputJsonValue,
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      errorMessage: null,
    },
  });
}

async function failJob(job: ClaimedJob, error: unknown) {
  const message =
    error instanceof Error ? error.message.slice(0, 8_000) : String(error);
  const retry = job.attempts < job.maxAttempts;
  const delaySeconds = Math.min(30 * 2 ** (job.attempts - 1), 15 * 60);
  await prisma.job.update({
    where: { id: job.id },
    data: {
      status: retry ? "PENDING" : "FAILED",
      scheduledAt: retry
        ? new Date(Date.now() + delaySeconds * 1000)
        : undefined,
      completedAt: retry ? null : new Date(),
      lockedAt: null,
      lockedBy: null,
      errorMessage: message,
    },
  });

  if (
    !retry &&
    ["PROCESS_VIDEO", "CREATE_THUMBNAIL", "GENERATE_HLS"].includes(job.type)
  ) {
    const payload = job.payload as JsonObject;
    if (typeof payload?.recordingId === "string") {
      await prisma.recording.updateMany({
        where: { id: payload.recordingId },
        data: {
          processingStatus: "FAILED",
          errorMessage: message.slice(0, 2_000),
        },
      });
    }
  }
  logger.error(
    {
      jobId: job.id,
      type: job.type,
      attempts: job.attempts,
      retry,
      error: message,
    },
    "Job failed",
  );
}

type JsonObject = Record<string, unknown>;

async function run() {
  logger.info({ workerId: env.WORKER_ID }, "Worker started");
  await recoverStaleJobs();

  while (!stopping) {
    try {
      await scheduleAttendanceJobs();
      await scheduleMaterialPreviewJobs();

      const job = await claimJob();
      if (!job) {
        await sleep(env.WORKER_POLL_INTERVAL_MS);
        continue;
      }
      logger.info({ jobId: job.id, type: job.type }, "Processing job");
      try {
        const result = await processJob(job.type, job.payload);
        await completeJob(job.id, result);
        logger.info({ jobId: job.id, type: job.type }, "Job completed");
      } catch (error) {
        await failJob(job, error);
      }
    } catch (error) {
      logger.error({ error }, "Worker loop failed");
      await sleep(env.WORKER_POLL_INTERVAL_MS);
    }
  }
}

function requestShutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, "Worker is shutting down");
}

process.once("SIGTERM", () => requestShutdown("SIGTERM"));
process.once("SIGINT", () => requestShutdown("SIGINT"));

run()
  .then(disconnectDatabase)
  .catch(async (error) => {
    logger.fatal({ error }, "Worker terminated unexpectedly");
    await disconnectDatabase();
    process.exitCode = 1;
  });
