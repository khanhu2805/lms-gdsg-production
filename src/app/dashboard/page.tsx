import Link from "next/link";
import {
  BookOpenCheck,
  CalendarClock,
  CircleAlert,
  GraduationCap,
  Video,
} from "lucide-react";

import { StatCard } from "@/components/ui/stat-card";
import { ROLE_LABELS } from "@/config/roles";
import { classScopeWhere } from "@/modules/classes/class.repository";
import { requireActor } from "@/lib/auth/actor";
import { prisma } from "@/lib/database/client";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function DashboardPage() {
  const actor = await requireActor();
  const scopedClasses = await prisma.courseClass.findMany({
    where: classScopeWhere(actor),
    select: { id: true },
  });
  const classIds = scopedClasses.map(({ id }) => id);
  const now = new Date();

  const [activeClasses, upcomingSessions, publishedContents, attentionCount] =
    await Promise.all([
      prisma.courseClass.count({
        where: {
          id: { in: classIds },
          status: "ACTIVE",
        },
      }),
      prisma.classSession.findMany({
        where: {
          classId: { in: classIds },
          status: { in: ["SCHEDULED", "ONGOING"] },
          endAt: { gte: now },
        },
        select: {
          id: true,
          title: true,
          startAt: true,
          endAt: true,
          mode: true,
          room: true,
          attendanceOpen: true,
          courseClass: {
            select: { code: true, name: true },
          },
        },
        orderBy: { startAt: "asc" },
        take: 5,
      }),
      prisma.content.count({
        where: {
          classId: { in: classIds },
          publicationStatus: "PUBLISHED",
          deletedAt: null,
        },
      }),
      getAttentionCount(actor.id, actor.role, classIds),
    ]);

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-[#667085]">
            {ROLE_LABELS[actor.role]}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#172033] sm:text-3xl">
            Xin chào, {actor.name}
          </h1>
          <p className="mt-2 text-sm text-[#667085]">
            Đây là những thông tin cần chú ý trong hôm nay.
          </p>
        </div>
        <Link
          href="/dashboard/sessions"
          className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-[#243467] px-4 text-sm font-semibold text-white transition hover:bg-[#17244D]"
        >
          <CalendarClock aria-hidden="true" className="size-4" />
          Xem lịch học
        </Link>
      </div>

      <section
        aria-label="Số liệu tổng quan"
        className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Lớp đang hoạt động"
          value={activeClasses}
          hint="Theo phạm vi được phân quyền"
          icon={GraduationCap}
          tone="navy"
        />
        <StatCard
          label="Buổi học sắp tới"
          value={upcomingSessions.length}
          hint="5 buổi gần nhất"
          icon={CalendarClock}
          tone="blue"
        />
        <StatCard
          label="Nội dung đã xuất bản"
          value={publishedContents}
          hint="Trong các lớp đang truy cập"
          icon={BookOpenCheck}
          tone="green"
        />
        <StatCard
          label="Cần xử lý"
          value={attentionCount}
          hint="Theo đúng vai trò hiện tại"
          icon={CircleAlert}
          tone={attentionCount > 0 ? "amber" : "green"}
        />
      </section>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
        <section className="rounded-2xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center justify-between border-b border-[#EAECF0] px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-semibold text-[#172033]">Lịch học sắp tới</h2>
              <p className="mt-1 text-xs text-[#667085]">
                Thời gian hiển thị theo múi giờ hệ thống
              </p>
            </div>
            <Link
              href="/dashboard/sessions"
              className="text-sm font-semibold text-[#4059A5] hover:text-[#243467]"
            >
              Xem tất cả
            </Link>
          </div>
          <div className="divide-y divide-[#EAECF0]">
            {upcomingSessions.length ? (
              upcomingSessions.map((session) => (
                <article
                  key={session.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <CalendarClock aria-hidden="true" className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#172033]">
                      {session.title}
                    </p>
                    <p className="mt-1 truncate text-xs text-[#667085]">
                      {session.courseClass.code} ·{" "}
                      {dateFormatter.format(session.startAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.attendanceOpen ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        Đang điểm danh
                      </span>
                    ) : null}
                    <span className="rounded-full bg-[#F2F4F7] px-2.5 py-1 text-xs font-medium text-[#475467]">
                      {session.mode === "ONLINE"
                        ? "Trực tuyến"
                        : (session.room ?? "Tại lớp")}
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <p className="px-6 py-12 text-center text-sm text-[#667085]">
                Chưa có buổi học sắp tới.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl bg-[#243467] p-6 text-white shadow-sm">
          <span className="flex size-11 items-center justify-center rounded-xl bg-white/10">
            <Video aria-hidden="true" className="size-5" />
          </span>
          <h2 className="mt-5 text-lg font-semibold">Không gian học tập</h2>
          <p className="mt-2 text-sm leading-6 text-blue-100">
            Video và tài liệu chỉ được phát qua tuyến bảo vệ. Mọi truy cập đều
            được kiểm tra quyền theo lớp và người dùng.
          </p>
          <Link
            href="/dashboard/contents"
            className="mt-6 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#243467] hover:bg-blue-50"
          >
            Mở kho nội dung
          </Link>
        </section>
      </div>
    </div>
  );
}

async function getAttentionCount(
  userId: string,
  role: string,
  classIds: string[],
) {
  if (role === "ADMIN" || role === "MANAGER") {
    return prisma.job.count({ where: { status: "FAILED" } });
  }
  if (role === "TEACHER") {
    return prisma.content.count({
      where: {
        classId: { in: classIds },
        publicationStatus: "PENDING_TEACHER_REVIEW",
      },
    });
  }
  if (role === "TEACHING_ASSISTANT") {
    return prisma.content.count({
      where: {
        creatorId: userId,
        publicationStatus: { in: ["DRAFT", "CHANGES_REQUESTED"] },
      },
    });
  }
  if (role === "STUDENT") {
    return prisma.assignment.count({
      where: {
        content: {
          classId: { in: classIds },
          publicationStatus: "PUBLISHED",
        },
        submissions: {
          none: {
            studentId: userId,
            status: { in: ["SUBMITTED", "GRADING", "GRADED"] },
          },
        },
      },
    });
  }
  return prisma.parentStudentLink.count({
    where: { parentId: userId, status: "ACTIVE" },
  });
}
