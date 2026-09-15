import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { ParentChildSwitcher } from "@/components/parent/child-switcher";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { NAVIGATION_BY_ROLE } from "@/config/navigation";
import { requireActor } from "@/lib/auth/actor";
import { resolveParentContext } from "@/modules/dashboard/parent-context";
import { parseDashboardPage, parseDashboardPageSize } from "@/modules/dashboard/query-options";
import { loadSectionData } from "@/modules/dashboard/section-data";

export const dynamic = "force-dynamic";

const SECTION_COPY: Record<
  string,
  { title: string; description: string; action?: string }
> = {
  users: {
    title: "Quản lý tài khoản",
    description:
      "Tạo trước tài khoản, gán vai trò, khóa truy cập và quản lý liên kết phụ huynh.",
    action: "Tạo tài khoản",
  },
  subjects: {
    title: "Môn học",
    description: "Quản lý danh mục môn học được dùng khi mở lớp.",
    action: "Thêm môn học",
  },
  classes: {
    title: "Lớp học",
    description:
      "Theo dõi sĩ số, giáo viên, trợ giảng và thành viên theo phạm vi được phân quyền.",
    action: "Tạo lớp",
  },
  sessions: {
    title: "Buổi học",
    description:
      "Lập lịch, mở điểm danh và truy cập phòng học trực tuyến an toàn.",
    action: "Tạo buổi học",
  },
  contents: {
    title: "Kho nội dung",
    description:
      "Quản lý bài học, video, tài liệu, bài tập và bài kiểm tra theo từng buổi.",
    action: "Tạo nội dung",
  },
  reviews: {
    title: "Duyệt nội dung",
    description:
      "Kiểm tra nội dung trợ giảng gửi lên trước khi cho phép xuất bản.",
  },
  videos: {
    title: "Video bài giảng",
    description: "Theo dõi trạng thái xử lý, thumbnail, HLS và tiến độ xem.",
    action: "Tải video lên",
  },
  materials: {
    title: "Tài liệu học tập",
    description: "Xem tài liệu học tập được cung cấp theo từng lớp và buổi học.",
    action: "Tải tài liệu lên",
  },
  lessons: {
    title: "Bài học",
    description: "Đọc nội dung đã xuất bản theo trình tự từng buổi học.",
  },
  assignments: {
    title: "Bài tập",
    description: "Giao bài, lưu nháp tự động, nộp bài và theo dõi số lần làm.",
    action: "Tạo bài tập",
  },
  quizzes: {
    title: "Bài kiểm tra",
    description:
      "Làm bài theo đồng hồ máy chủ và công bố đáp án đúng thời điểm.",
    action: "Tạo bài kiểm tra",
  },
  grading: {
    title: "Chấm điểm",
    description:
      "Chấm tự luận, ghi nhận đề xuất của trợ giảng và công bố kết quả.",
  },
  attendance: {
    title: "Điểm danh",
    description: "Theo dõi có mặt, đi trễ, vắng và toàn bộ lịch sử điều chỉnh.",
  },
  reports: {
    title: "Báo cáo",
    description:
      "Tạo báo cáo nền và tải tệp kết quả qua tuyến tải xuống bảo vệ.",
    action: "Tạo báo cáo",
  },
  jobs: {
    title: "Job nền",
    description:
      "Theo dõi xử lý video, báo cáo, điểm danh và thử lại các job thất bại.",
  },
  audit: {
    title: "Nhật ký kiểm toán",
    description:
      "Tra cứu thao tác quan trọng, người thực hiện và dấu vết thay đổi.",
  },
  settings: {
    title: "Cài đặt hệ thống",
    description:
      "Cấu hình chính sách dung lượng, điểm danh, video và thời gian lưu trữ.",
    action: "Thêm cài đặt",
  },
  children: {
    title: "Con của tôi",
    description: "Chuyển giữa hồ sơ học tập của các học sinh đã liên kết.",
  },
  results: {
    title: "Kết quả học tập",
    description: "Xem điểm đã công bố và nhận xét theo từng lớp.",
  },
  progress: {
    title: "Tiến độ học tập",
    description:
      "Theo dõi mức độ hoàn thành nội dung, video và hoạt động học tập.",
  },
  profile: {
    title: "Hồ sơ cá nhân",
    description: "Xem thông tin tài khoản được đồng bộ từ Google.",
  },
};

const CONTENT_CREATE_SECTIONS = [
  "contents",
  "videos",
  "materials",
  "assignments",
  "quizzes",
] as const;

const NON_PAGINATED_SECTIONS = new Set(["profile", "settings"]);
const PARENT_SCOPED_SECTIONS = new Set([
  "sessions",
  "assignments",
  "quizzes",
  "results",
  "attendance",
  "progress",
]);

function createHref(section: string) {
  const typeBySection: Record<string, string> = {
    videos: "VIDEO",
    materials: "MATERIAL",
    assignments: "ASSIGNMENT",
    quizzes: "QUIZ",
  };
  if (section in typeBySection) {
    return `/dashboard/contents/new?type=${typeBySection[section]}`;
  }
  return `/dashboard/${section}/new`;
}

export default async function SectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{
    q?: string;
    page?: string;
    pageSize?: string;
    studentId?: string;
  }>;
}) {
  const actor = await requireActor();
  const [{ section }, query] = await Promise.all([params, searchParams]);
  const copy = SECTION_COPY[section];
  const allowed = NAVIGATION_BY_ROLE[actor.role].some(
    ({ href }) => href === `/dashboard/${section}`,
  );

  if (!copy || !allowed) notFound();

  const search = query.q?.trim().slice(0, 120);
  const page = parseDashboardPage(query.page);
  const pageSize = parseDashboardPageSize(query.pageSize);
  const parentContext =
    actor.role === "PARENT"
      ? await resolveParentContext(actor, query.studentId)
      : null;
  const selectedStudentId = parentContext?.selectedStudentId ?? undefined;

  const data = await loadSectionData(actor, section, search, {
    page,
    pageSize,
    studentId: selectedStudentId,
  });
  const hasNext = data.rows.length > pageSize;
  const visibleRows = data.rows.slice(0, pageSize);

  const learnerOpenSections = new Set([
    "classes",
    "lessons",
    "videos",
    "materials",
    "assignments",
    "quizzes",
  ]);
  const isLearner =
    actor.role === "STUDENT" || actor.role === "PARENT";

  const contentSections = new Set([
    "lessons",
    "videos",
    "materials",
    "assignments",
    "quizzes",
  ]);

  const canOpen =
    (isLearner && learnerOpenSections.has(section)) ||
    (!isLearner && contentSections.has(section));
  const tableColumns = canOpen
    ? [...data.columns, "Thao tác"]
    : data.columns;
  const tableRows = canOpen
    ? visibleRows.map((row) => ({
      ...row,
      cells: [
        ...row.cells,
        <Link
          key={`open-${row.id}`}
          href={
            section === "classes"
              ? `/dashboard/classes/${row.id}`
              : isLearner
                ? `/dashboard/learn/${row.id}`
                : `/dashboard/contents/${row.id}`
          }
          className="inline-flex min-h-9 items-center rounded-lg border border-[#D0D5DD] bg-white px-3 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]"
        >
          Mở
        </Link>,
      ],
    }))
    : visibleRows;

  const canCreate =
    Boolean(copy.action) &&
    ((["ADMIN", "MANAGER"].includes(actor.role) &&
      [
        "users",
        "subjects",
        "classes",
        "sessions",
        "contents",
        "videos",
        "materials",
        "assignments",
        "quizzes",
        "reports",
      ].includes(section)) ||
      (CONTENT_CREATE_SECTIONS.includes(
        section as (typeof CONTENT_CREATE_SECTIONS)[number],
      ) &&
        ["TEACHER", "TEACHING_ASSISTANT"].includes(actor.role)) ||
      (section === "reports" && actor.role === "TEACHER") ||
      (section === "settings" && actor.role === "ADMIN"));

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#172033] sm:text-3xl">
            {copy.title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#667085]">
            {copy.description}
          </p>
        </div>
        {canCreate ? (
          <Link
            href={createHref(section)}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#4059A5] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#304783]"
          >
            <Plus className="size-4" />
            {copy.action}
          </Link>
        ) : null}
      </div>

      {parentContext && PARENT_SCOPED_SECTIONS.has(section) ? (
        <ParentChildSwitcher
          students={parentContext.children}
          selectedStudentId={parentContext.selectedStudentId}
          action={`/dashboard/${section}`}
          search={search}
          pageSize={pageSize}
        />
      ) : null}

      <section className="mt-7">
        <form
          method="get"
          className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <label className="relative w-full max-w-lg">
            <span className="sr-only">Tìm kiếm trong danh sách</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#98A2B3]" />
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder={`Tìm trong ${copy.title.toLowerCase()}…`}
              className="h-11 w-full rounded-xl border border-[#D0D5DD] bg-white pr-4 pl-10 text-sm"
            />
          </label>
          {selectedStudentId ? (
            <input type="hidden" name="studentId" value={selectedStudentId} />
          ) : null}
          <input type="hidden" name="pageSize" value={pageSize} />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#D0D5DD] bg-white px-4 text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB]"
          >
            Tìm kiếm
          </button>
        </form>
        <DataTable columns={tableColumns} rows={tableRows} />
        {!NON_PAGINATED_SECTIONS.has(section) ? (
          <Pagination
            basePath={`/dashboard/${section}`}
            page={page}
            pageSize={pageSize}
            hasNext={hasNext}
            params={{ q: search, studentId: selectedStudentId }}
          />
        ) : null}
      </section>
    </div>
  );
}
