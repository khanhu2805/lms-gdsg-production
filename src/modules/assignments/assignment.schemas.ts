import { z } from "zod";

export const saveSubmissionSchema = z.object({
  action: z.enum(["SAVE", "SUBMIT"]),
  fileAssetIds: z.array(z.uuid()).max(10).default([]),
  answers: z
    .array(
      z.object({
        questionId: z.uuid(),
        answerText: z.string().max(100_000).nullable().optional(),
        selectedChoiceIds: z.array(z.uuid()).max(20).optional(),
      }),
    )
    .max(200),
});

export const gradeSubmissionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("SUGGEST"),
    score: z.number().min(0),
    feedback: z.string().trim().max(20_000).optional(),
    reason: z.string().trim().min(3).max(1000),
  }),
  z.object({
    action: z.literal("GRADE"),
    score: z.number().min(0),
    feedback: z.string().trim().max(20_000).optional(),
    reason: z.string().trim().min(3).max(1000),
  }),
  z.object({
    action: z.enum(["PUBLISH", "RETURN", "REQUIRE_RESUBMISSION"]),
    reason: z.string().trim().min(3).max(1000),
  }),
]);
