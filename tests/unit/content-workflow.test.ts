import { describe, expect, it } from "vitest";

import {
  canEditContent,
  resolveContentTransition,
} from "@/modules/contents/content.permissions";
import type { ContentSnapshot } from "@/modules/contents/content.types";

function content(overrides: Partial<ContentSnapshot> = {}): ContentSnapshot {
  return {
    id: "content-1",
    creatorId: "assistant-1",
    creatorRole: "TEACHING_ASSISTANT",
    publicationStatus: "DRAFT",
    ...overrides,
  };
}

describe("workflow nội dung", () => {
  it("trợ giảng gửi duyệt, giáo viên duyệt, trợ giảng xuất bản", () => {
    const assistant = {
      id: "assistant-1",
      role: "TEACHING_ASSISTANT" as const,
    };
    const teacher = { id: "teacher-1", role: "TEACHER" as const };
    const submitted = resolveContentTransition(
      assistant,
      content(),
      "SUBMIT_REVIEW",
    );
    expect(submitted).toBe("PENDING_TEACHER_REVIEW");

    const approved = resolveContentTransition(
      teacher,
      content({ publicationStatus: submitted }),
      "APPROVE",
    );
    expect(approved).toBe("APPROVED");
    expect(
      resolveContentTransition(
        assistant,
        content({ publicationStatus: approved }),
        "PUBLISH",
      ),
    ).toBe("PUBLISHED");
  });

  it("khóa chỉnh sửa bản đã xuất bản", () => {
    expect(
      canEditContent(
        { id: "admin", role: "ADMIN" },
        content({ publicationStatus: "PUBLISHED" }),
      ),
    ).toBe(false);
  });

  it("khóa chỉnh sửa khi nội dung đang chờ duyệt hoặc chờ mở lại", () => {
    for (const publicationStatus of [
      "PENDING_TEACHER_REVIEW",
      "REOPEN_REQUESTED",
      "HIDDEN",
      "REJECTED",
      "ARCHIVED",
    ] as const) {
      expect(
        canEditContent(
          { id: "admin", role: "ADMIN" },
          content({ publicationStatus }),
        ),
      ).toBe(false);
    }
  });

  it("quản trị viên sửa được các bản đang trong luồng biên tập", () => {
    for (const publicationStatus of [
      "DRAFT",
      "CHANGES_REQUESTED",
      "APPROVED",
      "REOPENED",
    ] as const) {
      expect(
        canEditContent(
          { id: "admin", role: "ADMIN" },
          content({ publicationStatus }),
        ),
      ).toBe(true);
    }
  });

  it("bắt buộc quy trình mở lại sau xuất bản", () => {
    expect(
      resolveContentTransition(
        { id: "assistant-1", role: "TEACHING_ASSISTANT" },
        content({ publicationStatus: "PUBLISHED" }),
        "REQUEST_REOPEN",
      ),
    ).toBe("REOPEN_REQUESTED");
    expect(
      resolveContentTransition(
        { id: "admin", role: "ADMIN" },
        content({ publicationStatus: "REOPEN_REQUESTED" }),
        "REOPEN",
      ),
    ).toBe("REOPENED");
  });

  it("từ chối chuyển trạng thái trái phép", () => {
    expect(() =>
      resolveContentTransition(
        { id: "student", role: "STUDENT" },
        content(),
        "PUBLISH",
      ),
    ).toThrowError(/không cho phép/i);
  });
});
