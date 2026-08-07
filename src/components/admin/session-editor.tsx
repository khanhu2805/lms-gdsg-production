"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarX2, ClipboardCheck, DoorOpen, DoorClosed } from "lucide-react";

import type { ResourceOption } from "@/modules/dashboard/resource-data";

import {
  apiRequest,
  BusyLabel,
  DANGER_BUTTON,
  Field,
  INPUT_CLASS,
  jsonRequest,
  MutationNotice,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  SectionCard,
  TEXTAREA_CLASS,
  toDateTimeInput,
} from "./admin-ui";

type SessionDetail = {
  id: string;
  classId: string;
  sessionNumber: number;
  title: string;
  description?: string | null;
  plannedContent?: string | null;
  startAt: string;
  endAt: string;
  mode: "ONLINE" | "OFFLINE" | "HYBRID";
  room?: string | null;
  meetingUrl?: string | null;
  status: string;
  cancellationReason?: string | null;
  attendanceOpen: boolean;
  attendanceOpenedAt?: string | null;
  attendanceClosedAt?: string | null;
  courseClass: { id: string; code: string; name: string; status: string };
  _count: { contents: number; attendance: number };
};

export function SessionEditor({
  mode,
  canEdit,
  entity,
  classes,
  defaultClassId,
  actorRole,
}: {
  mode: "create" | "detail";
  canEdit: boolean;
  entity: unknown;
  classes: ResourceOption[];
  defaultClassId?: string;
  actorRole: string;
}) {
  const router = useRouter();
  const session = entity as SessionDetail | null;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    message: string;
    tone: "success" | "error";
  }>();
  const canMarkAttendance = [
    "ADMIN",
    "MANAGER",
    "TEACHER",
    "TEACHING_ASSISTANT",
  ].includes(actorRole);

  function startMutation() {
    setBusy(true);
    setNotice(undefined);
  }

  function failMutation(error: unknown) {
    setNotice({
      message:
        error instanceof Error ? error.message : "Không thể xử lý buổi học.",
      tone: "error",
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startMutation();
    try {
      const payload = {
        ...(session
          ? { reason: String(formData.get("reason") ?? "") }
          : {
              classId: String(formData.get("classId") ?? ""),
              sessionNumber: Number(formData.get("sessionNumber")),
            }),
        title: String(formData.get("title") ?? ""),
        description:
          String(formData.get("description") ?? "").trim() ||
          (session ? null : undefined),
        plannedContent:
          String(formData.get("plannedContent") ?? "").trim() ||
          (session ? null : undefined),
        startAt: new Date(String(formData.get("startAt") ?? "")).toISOString(),
        endAt: new Date(String(formData.get("endAt") ?? "")).toISOString(),
        mode: String(formData.get("mode") ?? ""),
        room:
          String(formData.get("room") ?? "").trim() ||
          (session ? null : undefined),
        meetingUrl:
          String(formData.get("meetingUrl") ?? "").trim() ||
          (session ? null : undefined),
      };
      if (session) {
        await apiRequest(`/api/v1/sessions/${session.id}`, {
          method: "PATCH",
          ...jsonRequest(payload),
        });
        setNotice({ message: "Đã cập nhật buổi học.", tone: "success" });
        router.refresh();
      } else {
        const created = await apiRequest<{ id: string }>("/api/v1/sessions", {
          method: "POST",
          ...jsonRequest(payload),
        });
        router.push(`/dashboard/sessions/${created.id}`);
        router.refresh();
      }
    } catch (error) {
      failMutation(error);
    } finally {
      setBusy(false);
    }
  }

  async function operate(
    action: "CANCEL" | "OPEN_ATTENDANCE" | "CLOSE_ATTENDANCE",
  ) {
    if (!session) return;
    const reason = window.prompt(
      action === "CANCEL"
        ? "Nhập lý do hủy buổi học:"
        : "Nhập lý do thay đổi trạng thái điểm danh:",
    );
    if (!reason) return;
    startMutation();
    try {
      await apiRequest(`/api/v1/sessions/${session.id}`, {
        method: "PATCH",
        ...jsonRequest({ action, reason }),
      });
      setNotice({
        message: "Đã cập nhật trạng thái buổi học.",
        tone: "success",
      });
      router.refresh();
    } catch (error) {
      failMutation(error);
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {!session ? (
          <>
            <Field label="Lớp học" required>
              <select
                name="classId"
                defaultValue={defaultClassId ?? ""}
                required
                className={INPUT_CLASS}
              >
                <option value="">Chọn lớp đang hoạt động</option>
                {classes
                  .filter((courseClass) => courseClass.status === "ACTIVE")
                  .map((courseClass) => (
                    <option key={courseClass.id} value={courseClass.id}>
                      {courseClass.label}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Số thứ tự buổi" required>
              <input
                type="number"
                name="sessionNumber"
                min={1}
                required
                className={INPUT_CLASS}
              />
            </Field>
          </>
        ) : null}
        <Field label="Tên buổi học" required>
          <input
            name="title"
            defaultValue={session?.title ?? ""}
            minLength={2}
            maxLength={200}
            required
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Hình thức" required>
          <select
            name="mode"
            defaultValue={session?.mode ?? "ONLINE"}
            className={INPUT_CLASS}
          >
            <option value="ONLINE">Trực tuyến</option>
            <option value="OFFLINE">Trực tiếp</option>
            <option value="HYBRID">Kết hợp</option>
          </select>
        </Field>
        <Field label="Bắt đầu" required>
          <input
            type="datetime-local"
            name="startAt"
            defaultValue={toDateTimeInput(session?.startAt)}
            required
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Kết thúc" required>
          <input
            type="datetime-local"
            name="endAt"
            defaultValue={toDateTimeInput(session?.endAt)}
            required
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Phòng học">
          <input
            name="room"
            defaultValue={session?.room ?? ""}
            maxLength={200}
            className={INPUT_CLASS}
          />
        </Field>
        <Field
          label="Link Google Meet"
          hint="Chỉ chấp nhận https://meet.google.com/..."
        >
          <input
            type="url"
            name="meetingUrl"
            defaultValue={session?.meetingUrl ?? ""}
            className={INPUT_CLASS}
          />
        </Field>
      </div>
      <Field label="Mô tả">
        <textarea
          name="description"
          defaultValue={session?.description ?? ""}
          className={TEXTAREA_CLASS}
        />
      </Field>
      <Field label="Nội dung dự kiến">
        <textarea
          name="plannedContent"
          defaultValue={session?.plannedContent ?? ""}
          className={TEXTAREA_CLASS}
        />
      </Field>
      {session ? (
        <Field label="Lý do chỉnh sửa" required>
          <textarea
            name="reason"
            required
            minLength={3}
            className={TEXTAREA_CLASS}
          />
        </Field>
      ) : null}
      <div className="flex justify-end">
        <button disabled={busy} className={PRIMARY_BUTTON}>
          <BusyLabel
            busy={busy}
            idle={session ? "Lưu buổi học" : "Tạo buổi học"}
          />
        </button>
      </div>
    </form>
  );

  if (mode === "create") {
    return (
      <SectionCard
        title="Tạo buổi học"
        description="Hệ thống sẽ kiểm tra trùng lịch của lớp và phòng trước khi lưu."
        id="edit"
      >
        <MutationNotice {...notice} />
        <div className="mt-5">{form}</div>
      </SectionCard>
    );
  }

  if (!session) return null;

  return (
    <div className="space-y-5">
      <MutationNotice {...notice} />
      <SectionCard title="Thông tin buổi học">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <dt className="text-[#667085]">Lớp</dt>
            <dd className="mt-1 font-semibold">
              {session.courseClass.code} · {session.courseClass.name}
            </dd>
          </div>
          <div>
            <dt className="text-[#667085]">Số buổi</dt>
            <dd className="mt-1 font-semibold">{session.sessionNumber}</dd>
          </div>
          <div>
            <dt className="text-[#667085]">Trạng thái</dt>
            <dd className="mt-1 font-semibold">{session.status}</dd>
          </div>
          <div>
            <dt className="text-[#667085]">Nội dung</dt>
            <dd className="mt-1 font-semibold">{session._count.contents}</dd>
          </div>
          <div>
            <dt className="text-[#667085]">Đã điểm danh</dt>
            <dd className="mt-1 font-semibold">{session._count.attendance}</dd>
          </div>
        </dl>
        {session.cancellationReason ? (
          <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">
            Lý do hủy: {session.cancellationReason}
          </p>
        ) : null}
      </SectionCard>

      {canEdit && session.status !== "CANCELLED" ? (
        <SectionCard title="Chỉnh sửa buổi học" id="edit">
          {form}
        </SectionCard>
      ) : null}

      {canEdit || canMarkAttendance ? (
        <SectionCard
          title="Thao tác buổi học"
          description="Hủy buổi học là thao tác thay cho xóa cứng để giữ lịch sử và nhật ký."
        >
          <div className="flex flex-wrap gap-3">
            {canMarkAttendance ? (
              <Link
                href={`/dashboard/attendance/${session.id}`}
                className={PRIMARY_BUTTON}
              >
                <ClipboardCheck className="mr-2 size-4" />
                Quản lý điểm danh
              </Link>
            ) : null}
            {canEdit && session.status !== "CANCELLED" ? (
              session.attendanceOpen ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => operate("CLOSE_ATTENDANCE")}
                  className={SECONDARY_BUTTON}
                >
                  <DoorClosed className="mr-2 size-4" />
                  Đóng điểm danh
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => operate("OPEN_ATTENDANCE")}
                  className={SECONDARY_BUTTON}
                >
                  <DoorOpen className="mr-2 size-4" />
                  Mở điểm danh
                </button>
              )
            ) : null}
            {canEdit && session.status !== "CANCELLED" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => operate("CANCEL")}
                className={DANGER_BUTTON}
              >
                <CalendarX2 className="mr-2 size-4" />
                Hủy buổi học
              </button>
            ) : null}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
