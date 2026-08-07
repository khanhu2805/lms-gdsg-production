import { z } from "zod";

const jsonPrimitiveSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    jsonPrimitiveSchema,
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const settingKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(
    /^[A-Z][A-Z0-9_]*$/,
    "Khóa cài đặt chỉ gồm chữ in hoa, số và dấu gạch dưới.",
  );

export const createSettingSchema = z.object({
  key: settingKeySchema,
  value: jsonValueSchema,
  description: z.string().trim().max(1000).nullable().optional(),
  reason: z.string().trim().min(3).max(1000),
});

export const updateSettingSchema = z.object({
  value: jsonValueSchema,
  description: z.string().trim().max(1000).nullable().optional(),
  reason: z.string().trim().min(3).max(1000),
});
