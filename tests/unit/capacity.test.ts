import { describe, expect, it } from "vitest";

import { calculateCapacity, canAddStudent } from "@/modules/classes/capacity";

describe("sĩ số lớp", () => {
  it.each([
    [20, 0, "AVAILABLE"],
    [20, 16, "NEARLY_FULL"],
    [20, 20, "FULL"],
    [20, 21, "OVER_CAPACITY"],
  ] as const)("tính đúng trạng thái %i/%i", (capacity, count, state) => {
    expect(calculateCapacity(capacity, count).state).toBe(state);
  });

  it("chặn khi đầy nếu không có quyền và lý do", () => {
    expect(
      canAddStudent({
        capacity: 10,
        activeStudents: 10,
        actorRole: "MANAGER",
        hasOverridePermission: false,
        overrideReason: "Lý do hợp lệ",
      }),
    ).toBe(false);
  });

  it("chỉ cho Manager vượt sĩ số khi có grant và lý do", () => {
    expect(
      canAddStudent({
        capacity: 10,
        activeStudents: 10,
        actorRole: "MANAGER",
        hasOverridePermission: true,
        overrideReason: "Đã được phê duyệt",
      }),
    ).toBe(true);
  });

  it("từ chối dữ liệu âm hoặc sức chứa bằng không", () => {
    expect(() => calculateCapacity(0, 0)).toThrow();
    expect(() => calculateCapacity(10, -1)).toThrow();
  });
});
