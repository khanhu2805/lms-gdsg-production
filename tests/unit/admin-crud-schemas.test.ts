import { describe, expect, it } from "vitest";

import {
  createClassSchema,
  updateClassSchema,
} from "@/modules/classes/class.schemas";
import { createContentSchema } from "@/modules/contents/content.schemas";
import {
  createSettingSchema,
  updateSettingSchema,
} from "@/modules/settings/setting.schemas";
import {
  createClassSessionSchema,
  sessionOperationSchema,
} from "@/modules/sessions/session.schemas";
import {
  subjectInputSchema,
  subjectUpdateSchema,
} from "@/modules/subjects/subject.schemas";
import {
  createUserSchema,
  userMutationSchema,
} from "@/modules/users/user.schemas";

const id = "00000000-0000-4000-8000-000000000001";
const sessionId = "00000000-0000-4000-8000-000000000002";

describe("admin CRUD validation", () => {
  it("accepts a pre-created Google account and nullable profile fields", () => {
    const result = createUserSchema.parse({
      email: "  Admin@Example.com ",
      name: "Quản trị viên",
      role: "ADMIN",
      profile: {
        phone: null,
        studentCode: null,
        dateOfBirth: null,
      },
    });

    expect(result.email).toBe("admin@example.com");
    expect(result.profile?.phone).toBeNull();
  });

  it("requires an audit reason for destructive account actions", () => {
    expect(
      userMutationSchema.safeParse({ action: "DELETE", reason: "" }).success,
    ).toBe(false);
    expect(
      userMutationSchema.safeParse({
        action: "DELETE",
        reason: "Tài khoản tạo nhầm",
      }).success,
    ).toBe(true);
  });

  it("validates subject create, update and deactivate payloads", () => {
    expect(
      subjectInputSchema.parse({
        code: "toan",
        name: "Toán",
        isActive: true,
      }).code,
    ).toBe("TOAN");
    expect(
      subjectUpdateSchema.safeParse({
        isActive: false,
        reason: "Ngừng tuyển sinh",
      }).success,
    ).toBe(true);
  });

  it("validates class creation and optimistic-lock updates", () => {
    expect(
      createClassSchema.safeParse({
        code: "TOAN-10-A",
        name: "Toán 10A",
        subjectId: id,
        academicYear: "2026-2027",
        startDate: "2026-08-01",
        endDate: "2027-05-31",
        mode: "ONLINE",
        capacity: 30,
        status: "DRAFT",
      }).success,
    ).toBe(true);
    expect(
      updateClassSchema.safeParse({
        expectedVersion: 2,
        status: "ARCHIVED",
        confirmOverCapacity: false,
        reason: "Kết thúc khóa học",
      }).success,
    ).toBe(true);
  });

  it("validates session creation and cancellation", () => {
    expect(
      createClassSessionSchema.safeParse({
        classId: id,
        sessionNumber: 1,
        title: "Ôn tập chương 1",
        startAt: "2026-08-01T01:00:00.000Z",
        endAt: "2026-08-01T03:00:00.000Z",
        mode: "ONLINE",
        meetingUrl: "https://meet.google.com/abc-defg-hij",
      }).success,
    ).toBe(true);
    expect(
      sessionOperationSchema.safeParse({
        action: "CANCEL",
        reason: "Giáo viên nghỉ có phép",
      }).success,
    ).toBe(true);
  });

  it("accepts nullable content descriptions and a valid lesson", () => {
    expect(
      createContentSchema.safeParse({
        classId: id,
        classSessionId: sessionId,
        type: "LESSON",
        title: "Hệ phương trình",
        description: null,
        payload: {
          markdownContent: "# Bài học",
          learningObjectives: ["Giải được hệ phương trình"],
        },
      }).success,
    ).toBe(true);
  });

  it("validates JSON system settings and rejects unsafe keys", () => {
    expect(
      createSettingSchema.safeParse({
        key: "MAX_LOGIN_SESSIONS",
        value: { admin: 5, student: 2 },
        description: "Giới hạn phiên",
        reason: "Thiết lập chính sách ban đầu",
      }).success,
    ).toBe(true);
    expect(
      createSettingSchema.safeParse({
        key: "bad-key",
        value: true,
        reason: "Không hợp lệ",
      }).success,
    ).toBe(false);
    expect(
      updateSettingSchema.safeParse({
        value: ["mp4", "webm"],
        reason: "Bổ sung định dạng",
      }).success,
    ).toBe(true);
  });
});
