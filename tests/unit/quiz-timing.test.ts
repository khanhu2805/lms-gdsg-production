import { describe, expect, it } from "vitest";

import {
  calculateAttemptExpiry,
  getQuizAvailability,
} from "@/modules/quizzes/quiz-timing";

describe("đồng hồ bài kiểm tra", () => {
  const now = new Date("2026-07-30T01:00:00.000Z");

  it("lấy hạn sớm hơn giữa thời lượng và giờ đóng bài", () => {
    expect(
      calculateAttemptExpiry({
        serverNow: now,
        durationMinutes: 60,
        quizClosesAt: new Date("2026-07-30T01:30:00.000Z"),
      }).toISOString(),
    ).toBe("2026-07-30T01:30:00.000Z");
  });

  it("xác định chưa mở, đã đóng và hết thời gian lượt làm", () => {
    expect(
      getQuizAvailability({
        serverNow: now,
        opensAt: new Date("2026-07-30T02:00:00.000Z"),
      }),
    ).toBe("NOT_OPEN");
    expect(
      getQuizAvailability({
        serverNow: now,
        closesAt: now,
      }),
    ).toBe("CLOSED");
    expect(
      getQuizAvailability({
        serverNow: now,
        attemptExpiresAt: now,
      }),
    ).toBe("EXPIRED");
  });

  it("từ chối thời lượng không hợp lệ", () => {
    expect(() =>
      calculateAttemptExpiry({ serverNow: now, durationMinutes: 0 }),
    ).toThrow();
  });
});
