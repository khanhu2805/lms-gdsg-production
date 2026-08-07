import { z } from "zod";

export const subjectInputSchema = z.object({
  code: z.string().trim().min(2).max(50).toUpperCase(),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(4000).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const subjectUpdateSchema = subjectInputSchema.partial().extend({
  reason: z.string().trim().min(3).max(1000),
});

export const subjectListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  includeInactive: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});
