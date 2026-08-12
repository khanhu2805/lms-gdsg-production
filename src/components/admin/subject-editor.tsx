"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionDialogs } from "@/components/ui/action-dialogs";
import { ArchiveRestore, Ban } from "lucide-react";

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
} from "./admin-ui";

type SubjectDetail = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  classes?: Array<{
    id: string;
    code: string;
    name: string;
    status: string;
    academicYear: string;
  }>;
  _count?: { classes: number };
};

export function SubjectEditor({
  mode,
  entity,
}: {
  mode: "create" | "detail";
  entity: unknown;
}) {
  const router = useRouter();
  const { requestReason } = useActionDialogs();
  const subject = entity as SubjectDetail | null;
  const creating = mode === "create";
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    message: string;
    tone: "success" | "error";
  }>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setBusy(true);
    setNotice(undefined);
    try {
      const payload = {
        ...(subject ? {} : { code: String(formData.get("code") ?? "") }),
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? "").trim() || null,
        isActive: formData.get("isActive") === "on",
        ...(subject ? { reason: String(formData.get("reason") ?? "") } : {}),
      };
      if (subject) {
        await apiRequest(`/api/v1/subjects/${subject.id}`, {
          method: "PATCH",
          ...jsonRequest(payload),
        });
        setNotice({ message: "Đã cập nhật môn học.", tone: "success" });
        router.refresh();
      } else {
        const created = await apiRequest<{ id: string }>("/api/v1/subjects", {
          method: "POST",
          ...jsonRequest(payload),
        });
        router.push(`/dashboard/subjects/${created.id}`);
        router.refresh();
      }
    } catch (error) {
      setNotice({
        message:
          error instanceof Error ? error.message : "Không thể lưu môn học.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    if (!subject) return;
    const reason = await requestReason({
      title: subject.isActive
        ? "Ngừng sử dụng môn học"
        : "Kích hoạt lại môn học",
      description: subject.isActive
        ? "Các lớp và lịch sử đang tham chiếu môn học vẫn được giữ nguyên."
        : "Môn học sẽ được phép sử dụng lại khi tạo hoặc chỉnh sửa lớp.",
      confirmLabel: subject.isActive ? "Ngừng sử dụng" : "Kích hoạt lại",
      danger: subject.isActive,
    });
    if (!reason) return;
    setBusy(true);
    setNotice(undefined);
    try {
      if (subject.isActive) {
        await apiRequest(`/api/v1/subjects/${subject.id}`, {
          method: "DELETE",
          ...jsonRequest({ reason }),
        });
      } else {
        await apiRequest(`/api/v1/subjects/${subject.id}`, {
          method: "PATCH",
          ...jsonRequest({ isActive: true, reason }),
        });
      }
      setNotice({
        message: subject.isActive
          ? "Môn học đã ngừng sử dụng."
          : "Môn học đã được kích hoạt lại.",
        tone: "success",
      });
      router.refresh();
    } catch (error) {
      setNotice({
        message:
          error instanceof Error
            ? error.message
            : "Không thể thay đổi trạng thái.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <MutationNotice {...notice} />
      <SectionCard
        title={creating ? "Thêm môn học" : "Chỉnh sửa môn học"}
        description="Mã môn học là duy nhất. Ngừng sử dụng không xóa các lớp và lịch sử liên quan."
        id="edit"
      >
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mã môn học" required>
              <input
                name="code"
                defaultValue={subject?.code ?? ""}
                minLength={2}
                maxLength={50}
                required
                disabled={Boolean(subject)}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Tên môn học" required>
              <input
                name="name"
                defaultValue={subject?.name ?? ""}
                minLength={2}
                maxLength={200}
                required
                className={INPUT_CLASS}
              />
            </Field>
          </div>
          <Field label="Mô tả">
            <textarea
              name="description"
              defaultValue={subject?.description ?? ""}
              maxLength={4000}
              className={TEXTAREA_CLASS}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium text-[#344054]">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={subject?.isActive ?? true}
              className="size-4"
            />
            Đang được phép dùng để mở lớp
          </label>
          {subject ? (
            <Field label="Lý do chỉnh sửa" required>
              <textarea
                name="reason"
                required
                minLength={3}
                className={TEXTAREA_CLASS}
              />
            </Field>
          ) : null}
          <div className="flex flex-wrap justify-end gap-3">
            {subject ? (
              <button
                type="button"
                disabled={busy}
                onClick={toggleActive}
                className={subject.isActive ? DANGER_BUTTON : SECONDARY_BUTTON}
              >
                {subject.isActive ? (
                  <Ban className="mr-2 size-4" />
                ) : (
                  <ArchiveRestore className="mr-2 size-4" />
                )}
                {subject.isActive ? "Ngừng sử dụng" : "Kích hoạt lại"}
              </button>
            ) : null}
            <button disabled={busy} className={PRIMARY_BUTTON}>
              <BusyLabel
                busy={busy}
                idle={subject ? "Lưu thay đổi" : "Thêm môn học"}
              />
            </button>
          </div>
        </form>
      </SectionCard>

      {subject ? (
        <SectionCard
          title={`Các lớp đang tham chiếu (${subject._count?.classes ?? 0})`}
        >
          {subject.classes?.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {subject.classes.map((courseClass) => (
                <Link
                  key={courseClass.id}
                  href={`/dashboard/classes/${courseClass.id}`}
                  className="rounded-xl border border-[#E4E7EC] p-4 hover:bg-[#F9FAFB]"
                >
                  <p className="font-semibold text-[#172033]">
                    {courseClass.code} · {courseClass.name}
                  </p>
                  <p className="mt-1 text-xs text-[#667085]">
                    {courseClass.academicYear} · {courseClass.status}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#667085]">
              Chưa có lớp sử dụng môn học này.
            </p>
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}
