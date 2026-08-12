import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { ResourceEditor } from "@/components/admin/resource-editor";
import { LearnerClassDetail } from "@/components/learner/learner-class-detail";
import { LearnerSessionDetail } from "@/components/learner/learner-session-detail";
import { requireActor } from "@/lib/auth/actor";
import { loadResourcePageData } from "@/modules/dashboard/resource-data";
import { AppError } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

// const TITLES: Record<string, { singular: string; list: string }> = {
//   users: { singular: "tài khoản", list: "Quản lý tài khoản" },
//   subjects: { singular: "môn học", list: "Môn học" },
//   classes: { singular: "lớp học", list: "Lớp học" },
//   sessions: { singular: "buổi học", list: "Buổi học" },
//   contents: { singular: "nội dung", list: "Kho nội dung" },
//   attendance: { singular: "điểm danh", list: "Điểm danh" },
//   grading: { singular: "bài nộp", list: "Chấm điểm" },
//   reports: { singular: "báo cáo", list: "Báo cáo" },
//   jobs: { singular: "job", list: "Job nền" },
//   audit: { singular: "nhật ký", list: "Nhật ký kiểm toán" },
//   settings: { singular: "cài đặt", list: "Cài đặt hệ thống" },
// };

const TITLES: Record<string, { singular: string; list: string }> = {
  users: {
    singular: "tài khoản",
    list: "Quản lý tài khoản",
  },
  subjects: {
    singular: "môn học",
    list: "Môn học",
  },
  classes: {
    singular: "lớp học",
    list: "Lớp học",
  },
  sessions: {
    singular: "buổi học",
    list: "Buổi học",
  },

  contents: {
    singular: "nội dung",
    list: "Kho nội dung",
  },

  videos: {
    singular: "video",
    list: "Video bài giảng",
  },

  materials: {
    singular: "tài liệu",
    list: "Tài liệu học tập",
  },

  assignments: {
    singular: "bài tập",
    list: "Bài tập",
  },

  quizzes: {
    singular: "bài kiểm tra",
    list: "Bài kiểm tra",
  },

  attendance: {
    singular: "điểm danh",
    list: "Điểm danh",
  },
  grading: {
    singular: "bài nộp",
    list: "Chấm điểm",
  },
  reports: {
    singular: "báo cáo",
    list: "Báo cáo",
  },
  jobs: {
    singular: "job",
    list: "Job nền",
  },
  audit: {
    singular: "nhật ký",
    list: "Nhật ký kiểm toán",
  },
  settings: {
    singular: "cài đặt",
    list: "Cài đặt hệ thống",
  },
};

const RESOURCE_SECTION_ALIASES: Record<string, string> = {
  materials: "contents",
  assignments: "contents",
  quizzes: "contents",
};

const CONTENT_TYPE_BY_SECTION: Record<string, string> = {
  materials: "MATERIAL",
  assignments: "ASSIGNMENT",
  quizzes: "QUIZ",
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
  const resourceSection =
    RESOURCE_SECTION_ALIASES[section] ?? section;

  const isLearner = actor.role === "STUDENT" || actor.role === "PARENT";
  if (isLearner && id !== "new" && section === "classes") {
    return <LearnerClassDetail actor={actor} classId={id} />;
  }
  if (isLearner && id !== "new" && section === "sessions") {
    return <LearnerSessionDetail actor={actor} sessionId={id} />;
  }

  const title = TITLES[section];
  if (!title) notFound();

  // let data;
  // try {
  //   data = await loadResourcePageData(actor, section, id);
  // } catch {
  //   notFound();
  // }

  let data: Awaited<ReturnType<typeof loadResourcePageData>>;

  try {
    data = await loadResourcePageData(actor, section, id);
  } catch (error) {
    // Chỉ chuyển thành 404 khi dữ liệu thực sự không tồn tại
    // hoặc người dùng không được phép biết tài nguyên tồn tại.
    if (
      error instanceof AppError &&
      (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")
    ) {
      notFound();
    }

    // Không được nuốt lỗi Prisma, database, bug code...
    // Next.js sẽ đưa lỗi này vào error boundary và ghi log server.
    throw error;
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
          actor={{
            id: actor.id,
            role: actor.role,
          }}
          defaults={{
            type:
              defaults.type ??
              CONTENT_TYPE_BY_SECTION[section],
            classId: defaults.classId,
          }}
        />
      </div>
    </div>
  );
}
