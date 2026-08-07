import { z } from "zod";

export const markAttendanceSchema = z.object({
  studentId: z.uuid(),
  status: z.enum(["PRESENT", "LATE", "ABSENT", "EXCUSED", "PENDING"]),
  note: z.string().trim().max(1000).nullable().optional(),
  reason: z.string().trim().min(3).max(1000),
});
