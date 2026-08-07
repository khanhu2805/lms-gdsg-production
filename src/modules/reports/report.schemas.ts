import { z } from "zod";

export const createReportSchema = z.object({
  type: z.enum([
    "USERS",
    "CLASSES",
    "CAPACITY",
    "ATTENDANCE",
    "ASSIGNMENTS",
    "QUIZZES",
    "PROGRESS",
    "VIDEO",
    "STORAGE",
    "FAILED_JOBS",
  ]),
  parameters: z
    .object({
      classId: z.uuid().optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    })
    .default({}),
});
