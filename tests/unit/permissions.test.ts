import { describe, expect, it } from "vitest";

import {
  canAccessClass,
  canActOnUser,
  canCreateRole,
  canPublishOfficialGrade,
  canSuggestGrade,
} from "@/lib/authorization/permissions";

describe("phân quyền", () => {
  it("không cho Manager tác động Admin hoặc tạo Admin", () => {
    expect(
      canActOnUser(
        { id: "manager", role: "MANAGER" },
        { id: "admin", role: "ADMIN" },
        "LOCK",
      ),
    ).toBe(false);
    expect(canCreateRole("MANAGER", "ADMIN")).toBe(false);
    expect(canCreateRole("MANAGER", "TEACHER")).toBe(true);
  });

  it("không cho Admin tự khóa hoặc tự xóa", () => {
    expect(
      canActOnUser(
        { id: "same", role: "ADMIN" },
        { id: "same", role: "ADMIN" },
        "LOCK",
      ),
    ).toBe(false);
    expect(
      canActOnUser(
        { id: "same", role: "ADMIN" },
        { id: "same", role: "ADMIN" },
        "DELETE",
      ),
    ).toBe(false);
  });

  it("giới hạn tài nguyên theo quan hệ lớp", () => {
    expect(canAccessClass("TEACHER", { isTeacher: true })).toBe(true);
    expect(canAccessClass("TEACHER", { isAssistant: true })).toBe(false);
    expect(canAccessClass("STUDENT", { isStudent: true })).toBe(true);
    expect(canAccessClass("PARENT", { isLinkedParent: false })).toBe(false);
    expect(canAccessClass("ADMIN", {})).toBe(true);
  });

  it("tách đề xuất điểm của trợ giảng khỏi điểm chính thức", () => {
    expect(canSuggestGrade("TEACHING_ASSISTANT")).toBe(true);
    expect(canPublishOfficialGrade("TEACHING_ASSISTANT")).toBe(false);
    expect(canPublishOfficialGrade("TEACHER")).toBe(true);
  });
});
