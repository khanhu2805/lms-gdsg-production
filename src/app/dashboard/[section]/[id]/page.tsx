import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { ResourceEditor } from "@/components/admin/resource-editor";
import { requireActor } from "@/lib/auth/actor";
import { loadResourcePageData } from "@/modules/dashboard/resource-data";

export const dynamic = "force-dynamic";

const TITLES: Record<string, { singular: string; list: string }> = {
  users: { singular: "tài khoản", list: "Quản lý tài khoản" },
  subjects: { singular: "môn học", list: "Môn học" },
  classes: { singular: "lớp học", list: "Lớp học" },
  sessions: { singular: "buổi học", list: "Buổi học" },
  contents: { singular: "nội dung", list: "Kho nội dung" },
  attendance: { singular: "điểm danh", list: "Điểm danh" },
  grading: { singular: "bài nộp", list: "Chấm điểm" },
  reports: { singular: "báo cáo", list: "Báo cáo" },
  jobs: { singular: "job", list: "Job nền" },
  audit: { singular: "nhật ký", list: "Nhật ký kiểm toán" },
  settings: { singular: "cài đặt", list: "Cài đặt hệ thống" },
};

export default async function ResourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string; id: string }>;
  searchParams: Promise<{ type?: string; classId?: string }>;
}) {
  const actor = await requireActor();
  const [{ section, id }, defaults] = await Promise.all([params, searchParams]);
  const title = TITLES[section];
  if (!title) notFound();

  let data;
  try {
    data = await loadResourcePageData(actor, section, id);
  } catch {
    notFound();
  }

  return (
    <div>
      <Link
        href={`/dashboard/${section}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-[#4059A5] hover:text-[#243467]"
      >
        <ChevronLeft className="size-4" />
        Quay lại {title.list.toLowerCase()}
      </Link>
      <div className="mt-5">
        <p className="text-xs font-semibold tracking-wide text-[#667085] uppercase">
          {title.list}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#172033] sm:text-3xl">
          {data.mode === "create"
            ? `Thêm ${title.singular}`
            : `Chi tiết ${title.singular}`}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#667085]">
          Thao tác được kiểm tra quyền lại ở máy chủ và lưu dấu vết kiểm toán.
        </p>
      </div>
      <div className="mt-7">
        <ResourceEditor
          data={data}
          actor={{ id: actor.id, role: actor.role }}
          defaults={{
            type: defaults.type,
            classId: defaults.classId,
          }}
        />
      </div>
    </div>
  );
}
