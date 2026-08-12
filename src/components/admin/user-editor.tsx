"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionDialogs } from "@/components/ui/action-dialogs";
import {
  KeyRound,
  Link2,
  LockKeyhole,
  Trash2,
  UserRoundCheck,
} from "lucide-react";

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

type UserRole =
  "ADMIN" | "MANAGER" | "TEACHER" | "TEACHING_ASSISTANT" | "STUDENT" | "PARENT";

type UserDetail = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: "ACTIVE" | "INACTIVE" | "LOCKED";
  lockedAt?: string | null;
  deletedAt?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  profile?: {
    phone?: string | null;
    studentCode?: string | null;
    teacherCode?: string | null;
    assistantCode?: string | null;
    parentCode?: string | null;
    dateOfBirth?: string | null;
    address?: string | null;
    bio?: string | null;
    emergencyContact?: string | null;
  } | null;
  teacherMemberships?: Array<{
    type: string;
    courseClass: { id: string; code: string; name: string; status: string };
  }>;
  assistantMemberships?: Array<{
    courseClass: { id: string; code: string; name: string; status: string };
  }>;
  studentMemberships?: Array<{
    joinedAt: string;
    courseClass: { id: string; code: string; name: string; status: string };
  }>;
  parentLinks?: Array<{
    isPrimary: boolean;
    linkedAt: string;
    student: {
      id: string;
      name: string;
      email: string;
      profile?: { studentCode?: string | null } | null;
    };
  }>;
  _count?: { sessions: number };
};

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Quản trị viên",
  MANAGER: "Quản lý",
  TEACHER: "Giáo viên",
  TEACHING_ASSISTANT: "Trợ giảng",
  STUDENT: "Học sinh",
  PARENT: "Phụ huynh",
};

function nullable(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function profileFromForm(formData: FormData) {
  const dateOfBirth = nullable(formData, "dateOfBirth");
  return {
    phone: nullable(formData, "phone"),
    studentCode: nullable(formData, "studentCode"),
    teacherCode: nullable(formData, "teacherCode"),
    assistantCode: nullable(formData, "assistantCode"),
    parentCode: nullable(formData, "parentCode"),
    dateOfBirth: dateOfBirth || null,
    address: nullable(formData, "address"),
    bio: nullable(formData, "bio"),
    emergencyContact: nullable(formData, "emergencyContact"),
  };
}

export function UserEditor({
  mode,
  actorRole,
  entity,
  users,
}: {
  mode: "create" | "detail";
  actorRole: UserRole;
  entity: unknown;
  users: ResourceOption[];
}) {
  const router = useRouter();
  const { requestReason } = useActionDialogs();
  const user = entity as UserDetail | null;
  const [role, setRole] = useState<UserRole>(user?.role ?? "STUDENT");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    message: string;
    tone: "success" | "error";
  }>();
  const allowedRoles = (Object.keys(ROLE_LABELS) as UserRole[]).filter(
    (item) => actorRole === "ADMIN" || item !== "ADMIN",
  );
  const studentOptions = users.filter((option) => option.role === "STUDENT");

  async function submitCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(undefined);
    const formData = new FormData(event.currentTarget);
    try {
      const created = await apiRequest<{ id: string }>("/api/v1/users", {
        method: "POST",
        ...jsonRequest({
          name: String(formData.get("name") ?? ""),
          email: String(formData.get("email") ?? ""),
          role,
          profile: profileFromForm(formData),
        }),
      });
      router.push(`/dashboard/users/${created.id}`);
      router.refresh();
    } catch (error) {
      setNotice({
        message:
          error instanceof Error ? error.message : "Không thể tạo tài khoản.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setNotice(undefined);
    const formData = new FormData(event.currentTarget);
    try {
      await apiRequest(`/api/v1/users/${user.id}`, {
        method: "PATCH",
        ...jsonRequest({
          action: "UPDATE",
          name: String(formData.get("name") ?? ""),
          profile: profileFromForm(formData),
          reason: String(formData.get("reason") ?? ""),
        }),
      });
      setNotice({ message: "Đã cập nhật hồ sơ tài khoản.", tone: "success" });
      router.refresh();
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "Không thể cập nhật.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setNotice(undefined);
    const formData = new FormData(event.currentTarget);
    try {
      await apiRequest(`/api/v1/users/${user.id}`, {
        method: "PATCH",
        ...jsonRequest({
          action: "CHANGE_ROLE",
          role,
          reason: String(formData.get("reason") ?? ""),
        }),
      });
      setNotice({
        message: "Đã thay đổi vai trò và thu hồi phiên cũ.",
        tone: "success",
      });
      router.refresh();
    } catch (error) {
      setNotice({
        message:
          error instanceof Error ? error.message : "Không thể đổi vai trò.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function accountAction(
    action: "LOCK" | "UNLOCK" | "DELETE" | "RESTORE" | "REVOKE_SESSIONS",
  ) {
    if (!user) return;
    const reason = await requestReason({
      title: "Xác nhận thao tác tài khoản",
      description: `Thao tác ${action} sẽ được ghi vào nhật ký kiểm toán.`,
      confirmLabel: "Thực hiện",
      danger: action === "LOCK" || action === "DELETE",
    });
    if (!reason) return;
    setBusy(true);
    setNotice(undefined);
    try {
      await apiRequest(`/api/v1/users/${user.id}`, {
        method: "PATCH",
        ...jsonRequest({ action, reason }),
      });
      setNotice({
        message: "Thao tác tài khoản đã hoàn tất.",
        tone: "success",
      });
      router.refresh();
    } catch (error) {
      setNotice({
        message:
          error instanceof Error ? error.message : "Không thể xử lý tài khoản.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function linkStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    setBusy(true);
    setNotice(undefined);
    try {
      await apiRequest(`/api/v1/users/${user.id}/children`, {
        method: "POST",
        ...jsonRequest({
          studentId: String(formData.get("studentId") ?? ""),
          isPrimary: formData.get("isPrimary") === "on",
          reason: String(formData.get("reason") ?? ""),
        }),
      });
      setNotice({
        message: "Đã liên kết học sinh với phụ huynh.",
        tone: "success",
      });
      form.reset();
      router.refresh();
    } catch (error) {
      setNotice({
        message:
          error instanceof Error ? error.message : "Không thể tạo liên kết.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function unlinkStudent(studentId: string) {
    if (!user) return;
    const reason = await requestReason({
      title: "Gỡ liên kết phụ huynh – học sinh",
      description: "Liên kết sẽ ngừng hoạt động nhưng lịch sử vẫn được giữ lại.",
      confirmLabel: "Gỡ liên kết",
      danger: true,
    });
    if (!reason) return;
    setBusy(true);
    setNotice(undefined);
    try {
      await apiRequest(`/api/v1/users/${user.id}/children/${studentId}`, {
        method: "DELETE",
        ...jsonRequest({ reason }),
      });
      setNotice({ message: "Đã gỡ liên kết.", tone: "success" });
      router.refresh();
    } catch (error) {
      setNotice({
        message:
          error instanceof Error ? error.message : "Không thể gỡ liên kết.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  const profile = user?.profile;
  const profileFields = (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Số điện thoại">
        <input
          name="phone"
          defaultValue={profile?.phone ?? ""}
          className={INPUT_CLASS}
        />
      </Field>
      <Field label="Ngày sinh">
        <input
          type="date"
          name="dateOfBirth"
          defaultValue={toDateInput(profile?.dateOfBirth)}
          className={INPUT_CLASS}
        />
      </Field>
      <Field label="Mã học sinh">
        <input
          name="studentCode"
          defaultValue={profile?.studentCode ?? ""}
          className={INPUT_CLASS}
        />
      </Field>
      <Field label="Mã giáo viên">
        <input
          name="teacherCode"
          defaultValue={profile?.teacherCode ?? ""}
          className={INPUT_CLASS}
        />
      </Field>
      <Field label="Mã trợ giảng">
        <input
          name="assistantCode"
          defaultValue={profile?.assistantCode ?? ""}
          className={INPUT_CLASS}
        />
      </Field>
      <Field label="Mã phụ huynh">
        <input
          name="parentCode"
          defaultValue={profile?.parentCode ?? ""}
          className={INPUT_CLASS}
        />
      </Field>
      <Field label="Địa chỉ" className="sm:col-span-2">
        <input
          name="address"
          defaultValue={profile?.address ?? ""}
          className={INPUT_CLASS}
        />
      </Field>
      <Field label="Liên hệ khẩn cấp" className="sm:col-span-2">
        <input
          name="emergencyContact"
          defaultValue={profile?.emergencyContact ?? ""}
          className={INPUT_CLASS}
        />
      </Field>
      <Field label="Ghi chú hồ sơ" className="sm:col-span-2">
        <textarea
          name="bio"
          defaultValue={profile?.bio ?? ""}
          className={TEXTAREA_CLASS}
        />
      </Field>
    </div>
  );

  if (mode === "create") {
    return (
      <SectionCard
        title="Tạo tài khoản"
        description="Email Google phải được tạo trước tại đây; người dùng không thể tự đăng ký."
        id="edit"
      >
        <form onSubmit={submitCreate} className="space-y-5">
          <MutationNotice {...notice} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Họ và tên" required>
              <input
                name="name"
                minLength={2}
                maxLength={120}
                required
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Email Google" required>
              <input
                name="email"
                type="email"
                required
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Vai trò" required>
              <select
                name="role"
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole)}
                className={INPUT_CLASS}
              >
                {allowedRoles.map((item) => (
                  <option key={item} value={item}>
                    {ROLE_LABELS[item]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {profileFields}
          <div className="flex justify-end">
            <button disabled={busy} className={PRIMARY_BUTTON}>
              <BusyLabel busy={busy} idle="Tạo tài khoản" />
            </button>
          </div>
        </form>
      </SectionCard>
    );
  }

  if (!user) return null;

  const assignments = [
    ...(user.teacherMemberships ?? []).map((item) => ({
      ...item.courseClass,
      label: `Giáo viên ${item.type === "PRIMARY" ? "chính" : "phụ"}`,
    })),
    ...(user.assistantMemberships ?? []).map((item) => ({
      ...item.courseClass,
      label: "Trợ giảng",
    })),
    ...(user.studentMemberships ?? []).map((item) => ({
      ...item.courseClass,
      label: "Học sinh",
    })),
  ];

  return (
    <div className="space-y-5">
      <MutationNotice {...notice} />
      <SectionCard title="Thông tin tài khoản">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[#667085]">Email</dt>
            <dd className="mt-1 font-semibold text-[#172033]">{user.email}</dd>
          </div>
          <div>
            <dt className="text-[#667085]">Vai trò</dt>
            <dd className="mt-1 font-semibold text-[#172033]">
              {ROLE_LABELS[user.role]}
            </dd>
          </div>
          <div>
            <dt className="text-[#667085]">Trạng thái</dt>
            <dd className="mt-1 font-semibold text-[#172033]">
              {user.deletedAt ? "Đã xóa mềm" : user.status}
            </dd>
          </div>
          <div>
            <dt className="text-[#667085]">Số phiên đang lưu</dt>
            <dd className="mt-1 font-semibold text-[#172033]">
              {user._count?.sessions ?? 0}
            </dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard
        title="Chỉnh sửa hồ sơ"
        description="Mọi thay đổi đều phải kèm lý do và được lưu vào nhật ký."
        id="edit"
      >
        <form onSubmit={submitProfile} className="space-y-5">
          <Field label="Họ và tên" required>
            <input
              name="name"
              defaultValue={user.name}
              minLength={2}
              maxLength={120}
              required
              className={INPUT_CLASS}
            />
          </Field>
          {profileFields}
          <Field label="Lý do chỉnh sửa" required>
            <textarea
              name="reason"
              required
              minLength={3}
              className={TEXTAREA_CLASS}
            />
          </Field>
          <div className="flex justify-end">
            <button disabled={busy} className={PRIMARY_BUTTON}>
              <BusyLabel busy={busy} idle="Lưu hồ sơ" />
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Vai trò và phiên đăng nhập">
        <form
          onSubmit={changeRole}
          className="grid gap-4 md:grid-cols-[1fr_2fr_auto] md:items-end"
        >
          <Field label="Vai trò">
            <select
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
              className={INPUT_CLASS}
            >
              {allowedRoles.map((item) => (
                <option key={item} value={item}>
                  {ROLE_LABELS[item]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Lý do đổi vai trò" required>
            <input
              name="reason"
              minLength={3}
              required
              className={INPUT_CLASS}
            />
          </Field>
          <button
            disabled={busy || role === user.role}
            className={PRIMARY_BUTTON}
          >
            Đổi vai trò
          </button>
        </form>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => accountAction("REVOKE_SESSIONS")}
            className={SECONDARY_BUTTON}
          >
            <KeyRound className="mr-2 size-4" />
            Thu hồi mọi phiên
          </button>
          {user.status === "LOCKED" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => accountAction("UNLOCK")}
              className={SECONDARY_BUTTON}
            >
              <UserRoundCheck className="mr-2 size-4" />
              Mở khóa
            </button>
          ) : !user.deletedAt ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => accountAction("LOCK")}
              className={SECONDARY_BUTTON}
            >
              <LockKeyhole className="mr-2 size-4" />
              Khóa tài khoản
            </button>
          ) : null}
          {user.deletedAt ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => accountAction("RESTORE")}
              className={PRIMARY_BUTTON}
            >
              Khôi phục tài khoản
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => accountAction("DELETE")}
              className={DANGER_BUTTON}
            >
              <Trash2 className="mr-2 size-4" />
              Xóa mềm
            </button>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Lớp đang tham gia">
        {assignments.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {assignments.map((item) => (
              <Link
                key={`${item.id}-${item.label}`}
                href={`/dashboard/classes/${item.id}`}
                className="rounded-xl border border-[#E4E7EC] p-4 hover:bg-[#F9FAFB]"
              >
                <p className="font-semibold text-[#172033]">
                  {item.code} · {item.name}
                </p>
                <p className="mt-1 text-xs text-[#667085]">
                  {item.label} · {item.status}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#667085]">
            Tài khoản chưa tham gia lớp nào.
          </p>
        )}
      </SectionCard>

      {user.role === "PARENT" ? (
        <SectionCard
          title="Liên kết phụ huynh – học sinh"
          description="Liên kết chỉ có hiệu lực khi cả hai tài khoản đang hoạt động."
        >
          <div className="space-y-3">
            {(user.parentLinks ?? []).map((link) => (
              <div
                key={link.student.id}
                className="flex flex-col gap-3 rounded-xl border border-[#E4E7EC] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-[#172033]">
                    {link.student.name}
                  </p>
                  <p className="mt-1 text-xs text-[#667085]">
                    {link.student.profile?.studentCode ?? "Chưa có mã"} ·{" "}
                    {link.student.email}
                    {link.isPrimary ? " · Phụ huynh chính" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => unlinkStudent(link.student.id)}
                  className={DANGER_BUTTON}
                >
                  Gỡ liên kết
                </button>
              </div>
            ))}
          </div>
          <form
            onSubmit={linkStudent}
            className="mt-5 grid gap-4 md:grid-cols-2"
          >
            <Field label="Học sinh" required>
              <select name="studentId" required className={INPUT_CLASS}>
                <option value="">Chọn học sinh</option>
                {studentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Lý do liên kết" required>
              <input
                name="reason"
                minLength={3}
                required
                className={INPUT_CLASS}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-[#344054]">
              <input type="checkbox" name="isPrimary" className="size-4" />
              Đây là phụ huynh chính
            </label>
            <div className="flex justify-end">
              <button disabled={busy} className={PRIMARY_BUTTON}>
                <Link2 className="mr-2 size-4" />
                Thêm liên kết
              </button>
            </div>
          </form>
        </SectionCard>
      ) : null}
    </div>
  );
}
