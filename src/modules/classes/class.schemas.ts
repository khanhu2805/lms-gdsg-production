import { z } from "zod";

export const createClassSchema = z
  .object({
    code: z.string().trim().min(2).max(50).toUpperCase(),
    name: z.string().trim().min(2).max(200),
    subjectId: z.uuid(),
    academicYear: z.string().trim().min(4).max(20),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    mode: z.enum(["ONLINE", "OFFLINE", "HYBRID"]),
    capacity: z.coerce.number().int().min(1).max(10_000),
    status: z
      .enum(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"])
      .default("DRAFT"),
    description: z.string().trim().max(4000).optional(),
    internalNote: z.string().trim().max(4000).optional(),
  })
  .refine((value) => value.startDate <= value.endDate, {
    path: ["endDate"],
    message: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.",
  });

export const updateClassSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    name: z.string().trim().min(2).max(200).optional(),
    subjectId: z.uuid().optional(),
    academicYear: z.string().trim().min(4).max(20).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    mode: z.enum(["ONLINE", "OFFLINE", "HYBRID"]).optional(),
    capacity: z.coerce.number().int().min(1).max(10_000).optional(),
    status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    internalNote: z.string().trim().max(4000).nullable().optional(),
    confirmOverCapacity: z.boolean().default(false),
    reason: z.string().trim().min(3).max(1000),
  })
  .refine(
    (value) =>
      !value.startDate || !value.endDate || value.startDate <= value.endDate,
    {
      path: ["endDate"],
      message: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.",
    },
  );

export const addStudentSchema = z.object({
  studentId: z.uuid(),
  overrideReason: z.string().trim().min(3).max(1000).optional(),
});

export const transferStudentSchema = z.object({
  studentId: z.uuid(),
  sourceClassId: z.uuid(),
  destinationClassId: z.uuid(),
  overrideReason: z.string().trim().min(3).max(1000).optional(),
  reason: z.string().trim().min(3).max(1000),
});

export const assignClassStaffSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("TEACHER"),
    userId: z.uuid(),
    teacherType: z.enum(["PRIMARY", "SECONDARY"]).default("SECONDARY"),
    reason: z.string().trim().min(3).max(1000),
  }),
  z.object({
    role: z.literal("TEACHING_ASSISTANT"),
    userId: z.uuid(),
    reason: z.string().trim().min(3).max(1000),
  }),
]);

export const removeClassMemberSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
});

export const classListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
});
