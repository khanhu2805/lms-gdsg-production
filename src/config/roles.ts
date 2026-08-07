import type { UserRole } from "@/generated/prisma/enums";

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Quản trị viên",
  MANAGER: "Quản lý",
  TEACHER: "Giáo viên",
  TEACHING_ASSISTANT: "Trợ giảng",
  STUDENT: "Học sinh",
  PARENT: "Phụ huynh",
};

export const ADMINISTRATIVE_ROLES: readonly UserRole[] = ["ADMIN", "MANAGER"];

export const CLASS_STAFF_ROLES: readonly UserRole[] = [
  "ADMIN",
  "MANAGER",
  "TEACHER",
  "TEACHING_ASSISTANT",
];

export const GRADING_ROLES: readonly UserRole[] = [
  "ADMIN",
  "MANAGER",
  "TEACHER",
  "TEACHING_ASSISTANT",
];
