import { describe, expect, it } from "vitest";

import {
  canJoinSession,
  determineJoinAttendanceStatus,
} from "@/modules/attendance/attendance-policy";

const startAt = new Date("2026-07-30T01:00:00.000Z");
const endAt = new Date("2026-07-30T02:30:00.000Z");

describe("điểm danh khi vào lớp", () => {
  it("cho vào sớm trong khoảng cấu hình", () => {
    expect(
      canJoinSession({
        now: new Date("2026-07-30T00:50:00.000Z"),
        startAt,
        endAt,
        earlyMinutes: 15,
        cancelled: false,
      }),
    ).toBe(true);
  });

  it("phân biệt có mặt và đi trễ theo giờ máy chủ", () => {
    expect(
      determineJoinAttendanceStatus({
        sessionStartAt: startAt,
        joinedAt: new Date("2026-07-30T01:10:00.000Z"),
        earlyMinutes: 15,
        lateAfterMinutes: 10,
      }),
    ).toBe("PRESENT");
    expect(
      determineJoinAttendanceStatus({
        sessionStartAt: startAt,
        joinedAt: new Date("2026-07-30T01:10:01.000Z"),
        earlyMinutes: 15,
        lateAfterMinutes: 10,
      }),
    ).toBe("LATE");
  });

  it("chặn trước cửa sổ, sau giờ học và buổi đã hủy", () => {
    expect(() =>
      determineJoinAttendanceStatus({
        sessionStartAt: startAt,
        joinedAt: new Date("2026-07-30T00:40:00.000Z"),
        earlyMinutes: 15,
        lateAfterMinutes: 10,
      }),
    ).toThrow();
    expect(
      canJoinSession({
        now: new Date("2026-07-30T03:00:00.000Z"),
        startAt,
        endAt,
        earlyMinutes: 15,
        cancelled: false,
      }),
    ).toBe(false);
    expect(
      canJoinSession({
        now: startAt,
        startAt,
        endAt,
        earlyMinutes: 15,
        cancelled: true,
      }),
    ).toBe(false);
  });
});
