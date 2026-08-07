import { z } from "zod";

const roleSchema = z.enum([
  "ADMIN",
  "MANAGER",
  "TEACHER",
  "TEACHING_ASSISTANT",
  "STUDENT",
  "PARENT",
]);

const profileSchema = z.object({
  phone: z.string().trim().max(30).nullable().optional(),
  studentCode: z.string().trim().max(50).nullable().optional(),
  teacherCode: z.string().trim().max(50).nullable().optional(),
  assistantCode: z.string().trim().max(50).nullable().optional(),
  parentCode: z.string().trim().max(50).nullable().optional(),
  dateOfBirth: z.coerce.date().nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  emergencyContact: z.string().trim().max(255).nullable().optional(),
});

export const createUserSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((email) => email.toLowerCase()),
  name: z.string().trim().min(2).max(120),
  role: roleSchema,
  profile: profileSchema.optional(),
});

export const userMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("UPDATE"),
    name: z.string().trim().min(2).max(120).optional(),
    image: z.url().nullable().optional(),
    profile: profileSchema.optional(),
    reason: z.string().trim().min(3).max(1000),
  }),
  z.object({
    action: z.literal("CHANGE_ROLE"),
    role: roleSchema,
    reason: z.string().trim().min(3).max(1000),
  }),
  z.object({
    action: z.enum(["LOCK", "UNLOCK", "DELETE", "RESTORE", "REVOKE_SESSIONS"]),
    reason: z.string().trim().min(3).max(1000),
  }),
]);

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  role: roleSchema.optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "LOCKED"]).optional(),
});

export const parentStudentLinkSchema = z.object({
  studentId: z.uuid(),
  isPrimary: z.boolean().default(false),
  reason: z.string().trim().min(3).max(1000),
});

export const removeParentStudentLinkSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
});
