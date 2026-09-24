"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionDialogs } from "@/components/ui/action-dialogs";
import { Archive, ArrowRightLeft, UserMinus, UserPlus, Trash2, } from "lucide-react";

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
  toDateInput,
} from "./admin-ui";

type CourseClassDetail = {
  id: string;
  code: string;
  name: string;
  subjectId: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  mode: "ONLINE" | "OFFLINE" | "HYBRID";
  capacity: number;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  description?: string | null;
  internalNote?: string | null;
  version: number;
  subject: { id: string; code: string; name: string };
  teachers: Array<{
    teacherId: string;
    type: "PRIMARY" | "SECONDARY";
    teacher: { id: string; name: string; email: string; role: string };
  }>;
  assistants: Array<{
    assistantId: string;
    assistant: { id: string; name: string; email: string; role: string };
  }>;
  students: Array<{
    studentId: string;
    joinedAt: string;
    student: {
      id: string;
      name: string;
      email: string;
      profile?: { studentCode?: string | null } | null;
    };
  }>;
  sessions: Array<{
    id: string;
    sessionNumber: number;
    title: string;
    startAt: string;
    status: string;
  }>;
  _count: { students: number; sessions: number; contents: number };
};

export function ClassEditor({
  mode,
  canEdit,
  entity,
  subjects,
  classes,
  users,
  actorRole,
}: {
  mode: "create" | "detail";
  canEdit: boolean;
  entity: unknown;
  subjects: ResourceOption[];
  classes: ResourceOption[];
  users: ResourceOption[];
  actorRole: string;
}) {
  const {
    requestReason,
    confirmAction,
  } = useActionDialogs();
  const router = useRouter();
  const courseClass = entity as CourseClassDetail | null;
  const [busy, setBusy] = useState(false);
  const [staffRole, setStaffRole] = useState<"TEACHER" | "TEACHING_ASSISTANT">(
    "TEACHER",
  );
  const [notice, setNotice] = useState<{
    message: string;
    tone: "success" | "error";
  }>();
  const teachers = users.filter((user) => user.role === "TEACHER");
  const assistants = users.filter((user) => user.role === "TEACHING_ASSISTANT");
  const students = users.filter((user) => user.role === "STUDENT");

  function startMutation() {
    setBusy(true);
    setNotice(undefined);
  }

  function failMutation(error: unknown, fallback: string) {
    setNotice({
      message: error instanceof Error ? error.message : fallback,
      tone: "error",
    });
  }

  async function permanentlyDeleteClass() {
    if (!entity || actorRole !== "ADMIN") {
      return;
    }

    const confirmed =
      await confirmAction({
        title: "Xóa vĩnh viễn?",
        description:
          "Dữ liệu liên quan sẽ bị xóa và không thể khôi phục.",
        confirmLabel: "Tiếp tục",
        danger: true,
      });

    if (!confirmed) return;

    const reason =
      await requestReason({
        title: "Xác nhận xóa vĩnh viễn",
        description:
          "Nhập lý do để lưu vào nhật ký kiểm toán.",
        confirmLabel: "Xóa vĩnh viễn",
        danger: true,
      });

    if (!reason) return;

    setBusy(true);

    try {
      await apiRequest(
        `/api/v1/classes/${courseClass?.id}/purge`,
        {
          method: "DELETE",
          ...jsonRequest({ reason }),
        },
      );

      router.push("/dashboard/classes");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitClass(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startMutation();
    try {
      const payload = {
        ...(courseClass
          ? {
            expectedVersion: courseClass.version,
            reason: String(formData.get("reason") ?? ""),
            confirmOverCapacity: formData.get("confirmOverCapacity") === "on",
          }
          : {}),
        name: String(formData.get("name") ?? ""),
        subjectId: String(formData.get("subjectId") ?? ""),
        academicYear: String(formData.get("academicYear") ?? ""),
        startDate: String(formData.get("startDate") ?? ""),
        endDate: String(formData.get("endDate") ?? ""),
        mode: String(formData.get("mode") ?? ""),
        capacity: Number(formData.get("capacity")),
        status: String(formData.get("status") ?? ""),
        description:
          String(formData.get("description") ?? "").trim() ||
          (courseClass ? null : undefined),
        internalNote:
          String(formData.get("internalNote") ?? "").trim() ||
          (courseClass ? null : undefined),
      };
      if (courseClass) {
        await apiRequest(`/api/v1/classes/${courseClass.id}`, {
          method: "PATCH",
          ...jsonRequest(payload),
        });
        setNotice({ message: "Đã cập nhật lớp học.", tone: "success" });
        router.refresh();
      } else {
        const created = await apiRequest<{ id: string }>("/api/v1/classes", {
          method: "POST",
          ...jsonRequest(payload),
        });
        router.push(`/dashboard/classes/${created.id}`);
        router.refresh();
      }
    } catch (error) {
      failMutation(error, "Không thể lưu lớp học.");
    } finally {
      setBusy(false);
    }
  }

  async function assignStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!courseClass) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const role = String(formData.get("role"));
    startMutation();
    try {
      await apiRequest(`/api/v1/classes/${courseClass.id}/staff`, {
        method: "POST",
        ...jsonRequest({
          role,
          userId: String(formData.get("userId") ?? ""),
          ...(role === "TEACHER"
            ? {
              teacherType: String(formData.get("teacherType") ?? "SECONDARY"),
            }
            : {}),
          reason: String(formData.get("reason") ?? ""),
        }),
      });
      setNotice({ message: "Đã phân công nhân sự vào lớp.", tone: "success" });
      form.reset();
      router.refresh();
    } catch (error) {
      failMutation(error, "Không thể phân công nhân sự.");
    } finally {
      setBusy(false);
    }
  }

  async function addStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!courseClass) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    startMutation();
    try {
      await apiRequest(`/api/v1/classes/${courseClass.id}/students`, {
        method: "POST",
        ...jsonRequest({
          studentId: String(formData.get("studentId") ?? ""),
          overrideReason:
            String(formData.get("overrideReason") ?? "").trim() || undefined,
        }),
      });
      setNotice({ message: "Đã thêm học sinh vào lớp.", tone: "success" });
      form.reset();
      router.refresh();
    } catch (error) {
      failMutation(error, "Không thể thêm học sinh.");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(
    userId: string,
    role: "TEACHER" | "TEACHING_ASSISTANT" | "STUDENT",
  ) {
    if (!courseClass) return;
    const reason = await requestReason({
      title: "Gỡ thành viên khỏi lớp",
      description: "Thành viên sẽ được gỡ nhưng lịch sử liên quan vẫn được giữ lại.",
      confirmLabel: "Gỡ thành viên",
      danger: true,
    });
    if (!reason) return;
    startMutation();
    try {
      const url =
        role === "STUDENT"
          ? `/api/v1/classes/${courseClass.id}/students/${userId}`
          : `/api/v1/classes/${courseClass.id}/staff/${userId}?role=${role}`;
      await apiRequest(url, {
        method: "DELETE",
        ...jsonRequest({ reason }),
      });
      setNotice({
        message: "Đã gỡ thành viên và giữ lại lịch sử.",
        tone: "success",
      });
      router.refresh();
    } catch (error) {
      failMutation(error, "Không thể gỡ thành viên.");
    } finally {
      setBusy(false);
    }
  }

  async function transferStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!courseClass) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    startMutation();
    try {
      await apiRequest("/api/v1/classes/transfers", {
        method: "POST",
        ...jsonRequest({
          studentId: String(formData.get("studentId") ?? ""),
          sourceClassId: courseClass.id,
          destinationClassId: String(formData.get("destinationClassId") ?? ""),
          reason: String(formData.get("reason") ?? ""),
          overrideReason:
            String(formData.get("overrideReason") ?? "").trim() || undefined,
        }),
      });
      setNotice({
        message: "Đã chuyển học sinh sang lớp mới.",
        tone: "success",
      });
      form.reset();
      router.refresh();
    } catch (error) {
      failMutation(error, "Không thể chuyển lớp.");
    } finally {
      setBusy(false);
    }
  }

  async function archiveClass() {
    if (!courseClass) return;
    const reason = await requestReason({
      title: "Lưu trữ lớp học",
      description: "Lớp sẽ ngừng hoạt động nhưng dữ liệu lịch sử vẫn được giữ lại.",
      confirmLabel: "Lưu trữ lớp",
      danger: true,
    });
    if (!reason) return;
    startMutation();
    try {
      await apiRequest(`/api/v1/classes/${courseClass.id}`, {
        method: "PATCH",
        ...jsonRequest({
          expectedVersion: courseClass.version,
          status: "ARCHIVED",
          confirmOverCapacity: false,
          reason,
        }),
      });
      setNotice({ message: "Lớp đã được lưu trữ an toàn.", tone: "success" });
      router.refresh();
    } catch (error) {
      failMutation(error, "Không thể lưu trữ lớp.");
    } finally {
      setBusy(false);
    }
  }

  const classForm = (
    <form onSubmit={submitClass} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mã lớp">
          <input
            value={
              courseClass?.code ??
              "Tự động tạo sau khi lưu"
            }
            disabled
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Tên lớp" required>
          <input
            name="name"
            defaultValue={courseClass?.name ?? ""}
            required
            minLength={2}
            maxLength={200}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Môn học" required>
          <select
            name="subjectId"
            defaultValue={courseClass?.subjectId ?? ""}
            required
            className={INPUT_CLASS}
          >
            <option value="">Chọn môn học</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Năm học" required>
          <input
            name="academicYear"
            defaultValue={courseClass?.academicYear ?? "2026-2027"}
            required
            minLength={4}
            maxLength={20}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Ngày bắt đầu" required>
          <input
            type="date"
            name="startDate"
            defaultValue={toDateInput(courseClass?.startDate)}
            required
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Ngày kết thúc" required>
          <input
            type="date"
            name="endDate"
            defaultValue={toDateInput(courseClass?.endDate)}
            required
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Hình thức" required>
          <select
            name="mode"
            defaultValue={courseClass?.mode ?? "ONLINE"}
            className={INPUT_CLASS}
          >
            <option value="ONLINE">Trực tuyến</option>
            <option value="OFFLINE">Trực tiếp</option>
            <option value="HYBRID">Kết hợp</option>
          </select>
        </Field>
        <Field label="Sức chứa" required>
          <input
            type="number"
            name="capacity"
            min={1}
            max={10000}
            defaultValue={courseClass?.capacity ?? 30}
            required
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Trạng thái" required>
          <select
            name="status"
            defaultValue={courseClass?.status ?? "DRAFT"}
            className={INPUT_CLASS}
          >
            <option value="DRAFT">Nháp</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="COMPLETED">Đã hoàn thành</option>
            <option value="ARCHIVED">Đã lưu trữ</option>
          </select>
        </Field>
      </div>
      <Field label="Mô tả">
        <textarea
          name="description"
          defaultValue={courseClass?.description ?? ""}
          className={TEXTAREA_CLASS}
        />
      </Field>
      <Field label="Ghi chú nội bộ">
        <textarea
          name="internalNote"
          defaultValue={courseClass?.internalNote ?? ""}
          className={TEXTAREA_CLASS}
        />
      </Field>
      {courseClass ? (
        <>
          <Field label="Lý do chỉnh sửa" required>
            <textarea
              name="reason"
              required
              minLength={3}
              className={TEXTAREA_CLASS}
            />
          </Field>
          <label className="flex items-start gap-2 text-sm text-[#344054]">
            <input
              type="checkbox"
              name="confirmOverCapacity"
              className="mt-0.5 size-4"
            />
            Tôi xác nhận nếu sức chứa mới thấp hơn sĩ số hiện tại, lớp sẽ được
            đánh dấu vượt sức chứa.
          </label>
        </>
      ) : null}
      <div className="flex flex-wrap justify-end gap-3">
        {courseClass && courseClass.status !== "ARCHIVED" ? (
          <button
            type="button"
            disabled={busy}
            onClick={archiveClass}
            className={DANGER_BUTTON}
          >
            <Archive className="mr-2 size-4" />
            Lưu trữ lớp
          </button>
        ) : null}
        {courseClass && actorRole === "ADMIN" ? (
          <button
            type="button"
            disabled={busy}
            onClick={permanentlyDeleteClass}
            className={DANGER_BUTTON}
          >
            <Trash2 className="mr-2 size-4" />
            Xóa vĩnh viễn
          </button>
        ) : null}
        <button disabled={busy} className={PRIMARY_BUTTON}>
          <BusyLabel
            busy={busy}
            idle={courseClass ? "Lưu thay đổi" : "Tạo lớp học"}
          />
        </button>
      </div>
    </form>
  );

  if (mode === "create") {
    return (
      <SectionCard
        title="Tạo lớp học"
        description="Lớp mới được tạo ở trạng thái nháp; hãy phân nhân sự và học sinh trước khi kích hoạt."
        id="edit"
      >
        <MutationNotice {...notice} />
        <div className="mt-5">{classForm}</div>
      </SectionCard>
    );
  }

  if (!courseClass) return null;

  return (
    <div className="space-y-5">
      <MutationNotice {...notice} />
      <SectionCard title="Tổng quan lớp học">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <dt className="text-[#667085]">Mã lớp</dt>
            <dd className="mt-1 font-semibold">{courseClass.code}</dd>
          </div>
          <div>
            <dt className="text-[#667085]">Môn học</dt>
            <dd className="mt-1 font-semibold">{courseClass.subject.name}</dd>
          </div>
          <div>
            <dt className="text-[#667085]">Sĩ số</dt>
            <dd className="mt-1 font-semibold">
              {courseClass._count.students}/{courseClass.capacity}
            </dd>
          </div>
          <div>
            <dt className="text-[#667085]">Buổi học</dt>
            <dd className="mt-1 font-semibold">
              {courseClass._count.sessions}
            </dd>
          </div>
          <div>
            <dt className="text-[#667085]">Nội dung</dt>
            <dd className="mt-1 font-semibold">
              {courseClass._count.contents}
            </dd>
          </div>
        </dl>
      </SectionCard>

      {canEdit ? (
        <SectionCard
          title="Chỉnh sửa lớp"
          description={`Phiên bản dữ liệu hiện tại: v${courseClass.version}.`}
          id="edit"
        >
          {classForm}
        </SectionCard>
      ) : null}

      <SectionCard title="Giáo viên và trợ giảng">
        <div className="space-y-3">
          {courseClass.teachers.map((membership) => (
            <div
              key={`teacher-${membership.teacher.id}`}
              className="flex flex-col gap-3 rounded-xl border border-[#E4E7EC] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold">{membership.teacher.name}</p>
                <p className="mt-1 text-xs text-[#667085]">
                  {membership.teacher.email} · Giáo viên{" "}
                  {membership.type === "PRIMARY" ? "chính" : "phụ"}
                </p>
              </div>
              {canEdit ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeMember(membership.teacher.id, "TEACHER")}
                  className={DANGER_BUTTON}
                >
                  <UserMinus className="mr-2 size-4" />
                  Gỡ
                </button>
              ) : null}
            </div>
          ))}
          {courseClass.assistants.map((membership) => (
            <div
              key={`assistant-${membership.assistant.id}`}
              className="flex flex-col gap-3 rounded-xl border border-[#E4E7EC] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold">{membership.assistant.name}</p>
                <p className="mt-1 text-xs text-[#667085]">
                  {membership.assistant.email} · Trợ giảng
                </p>
              </div>
              {canEdit ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    removeMember(membership.assistant.id, "TEACHING_ASSISTANT")
                  }
                  className={DANGER_BUTTON}
                >
                  <UserMinus className="mr-2 size-4" />
                  Gỡ
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {canEdit ? (
          <form
            onSubmit={assignStaff}
            className="mt-5 grid gap-4 md:grid-cols-2"
          >
            <Field label="Vai trò" required>
              <select
                name="role"
                value={staffRole}
                onChange={(event) =>
                  setStaffRole(
                    event.target.value as "TEACHER" | "TEACHING_ASSISTANT",
                  )
                }
                required
                className={INPUT_CLASS}
              >
                <option value="TEACHER">Giáo viên</option>
                <option value="TEACHING_ASSISTANT">Trợ giảng</option>
              </select>
            </Field>
            <Field
              label="Người được phân công"
              hint="Danh sách gồm giáo viên và trợ giảng đang hoạt động."
              required
            >
              <select name="userId" required className={INPUT_CLASS}>
                <option value="">Chọn tài khoản</option>
                {(staffRole === "TEACHER" ? teachers : assistants).map(
                  (user) => (
                    <option key={user.id} value={user.id}>
                      {user.label}
                    </option>
                  ),
                )}
              </select>
            </Field>
            {staffRole === "TEACHER" ? (
              <Field label="Loại giáo viên">
                <select name="teacherType" className={INPUT_CLASS}>
                  <option value="SECONDARY">Giáo viên phụ</option>
                  <option value="PRIMARY">Giáo viên chính</option>
                </select>
              </Field>
            ) : (
              <div />
            )}
            <Field label="Lý do phân công" required>
              <input
                name="reason"
                required
                minLength={3}
                className={INPUT_CLASS}
              />
            </Field>
            <div className="md:col-span-2 md:flex md:justify-end">
              <button disabled={busy} className={PRIMARY_BUTTON}>
                <UserPlus className="mr-2 size-4" />
                Phân công
              </button>
            </div>
          </form>
        ) : null}
      </SectionCard>

      <SectionCard title={`Học sinh (${courseClass.students.length})`}>
        <div className="space-y-3">
          {courseClass.students.map((membership) => (
            <div
              key={membership.student.id}
              className="flex flex-col gap-3 rounded-xl border border-[#E4E7EC] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold">{membership.student.name}</p>
                <p className="mt-1 text-xs text-[#667085]">
                  {membership.student.profile?.studentCode ?? "Chưa có mã"} ·{" "}
                  {membership.student.email}
                </p>
              </div>
              {canEdit ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeMember(membership.student.id, "STUDENT")}
                  className={DANGER_BUTTON}
                >
                  <UserMinus className="mr-2 size-4" />
                  Rời lớp
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {canEdit ? (
          <>
            <form
              onSubmit={addStudent}
              className="mt-5 grid gap-4 md:grid-cols-3"
            >
              <Field label="Học sinh" required className="md:col-span-2">
                <select name="studentId" required className={INPUT_CLASS}>
                  <option value="">Chọn học sinh</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex items-end">
                <button disabled={busy} className={`${PRIMARY_BUTTON} w-full`}>
                  <UserPlus className="mr-2 size-4" />
                  Thêm học sinh
                </button>
              </div>
              <Field
                label="Lý do vượt sức chứa (nếu có)"
                className="md:col-span-3"
              >
                <input name="overrideReason" className={INPUT_CLASS} />
              </Field>
            </form>

            <form
              onSubmit={transferStudent}
              className="mt-6 grid gap-4 rounded-xl border border-[#E4E7EC] bg-[#F9FAFB] p-4 md:grid-cols-2"
            >
              <h3 className="font-semibold text-[#172033] md:col-span-2">
                Chuyển lớp an toàn
              </h3>
              <Field label="Học sinh trong lớp" required>
                <select name="studentId" required className={INPUT_CLASS}>
                  <option value="">Chọn học sinh</option>
                  {courseClass.students.map((membership) => (
                    <option
                      key={membership.student.id}
                      value={membership.student.id}
                    >
                      {membership.student.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Lớp đích" required>
                <select
                  name="destinationClassId"
                  required
                  className={INPUT_CLASS}
                >
                  <option value="">Chọn lớp đích</option>
                  {classes
                    .filter((item) => item.id !== courseClass.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Lý do chuyển lớp" required>
                <input
                  name="reason"
                  required
                  minLength={3}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Lý do vượt sức chứa (nếu có)">
                <input name="overrideReason" className={INPUT_CLASS} />
              </Field>
              <div className="md:col-span-2 md:flex md:justify-end">
                <button disabled={busy} className={SECONDARY_BUTTON}>
                  <ArrowRightLeft className="mr-2 size-4" />
                  Chuyển lớp
                </button>
              </div>
            </form>
          </>
        ) : null}
      </SectionCard>

      <SectionCard title={`Buổi học (${courseClass.sessions.length})`}>
        {courseClass.sessions.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {courseClass.sessions.map((session) => (
              <Link
                key={session.id}
                href={`/dashboard/sessions/${session.id}`}
                className="rounded-xl border border-[#E4E7EC] p-4 hover:bg-[#F9FAFB]"
              >
                <p className="font-semibold">
                  Buổi {session.sessionNumber} · {session.title}
                </p>
                <p className="mt-1 text-xs text-[#667085]">
                  {new Date(session.startAt).toLocaleString("vi-VN")} ·{" "}
                  {session.status}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#667085]">Chưa có buổi học.</p>
        )}
        {canEdit ? (
          <div className="mt-5">
            <Link
              href={`/dashboard/sessions/new?classId=${courseClass.id}`}
              className={SECONDARY_BUTTON}
            >
              Tạo buổi học cho lớp
            </Link>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
