import { z } from "zod";

export const saveQuizAnswersSchema = z.object({
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

export const gradeQuizAttemptSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("SUGGEST"),
    score: z.number().min(0),
    reason: z.string().trim().min(3).max(1000),
  }),
  z.object({
    action: z.literal("GRADE"),
    score: z.number().min(0),
    reason: z.string().trim().min(3).max(1000),
  }),
  z.object({
    action: z.literal("PUBLISH"),
    reason: z.string().trim().min(3).max(1000),
  }),
]);
