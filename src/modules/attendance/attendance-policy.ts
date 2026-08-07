import type { AttendanceStatus } from "@/generated/prisma/enums";

export function determineJoinAttendanceStatus(input: {
  sessionStartAt: Date;
  joinedAt: Date;
  earlyMinutes: number;
  lateAfterMinutes: number;
}): AttendanceStatus {
  const windowOpensAt = new Date(
    input.sessionStartAt.getTime() - input.earlyMinutes * 60_000,
  );
  const lateAt = new Date(
    input.sessionStartAt.getTime() + input.lateAfterMinutes * 60_000,
  );

  if (input.joinedAt < windowOpensAt) {
    throw new Error("Buổi học chưa mở cho học sinh tham gia.");
  }

  return input.joinedAt <= lateAt ? "PRESENT" : "LATE";
}

export function canJoinSession(input: {
  now: Date;
  startAt: Date;
  endAt: Date;
  earlyMinutes: number;
  cancelled: boolean;
}) {
  if (input.cancelled) return false;
  const opensAt = new Date(
    input.startAt.getTime() - input.earlyMinutes * 60_000,
  );
  return input.now >= opensAt && input.now <= input.endAt;
}
