import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Database,
  DoorOpen,
  FileCheck2,
  Gauge,
  GraduationCap,
  HardDrive,
  ListChecks,
  School,
  UserCheck,
  UsersRound,
  Video,
} from "lucide-react";

import { ParentChildSwitcher } from "@/components/parent/child-switcher";
import { StatCard } from "@/components/ui/stat-card";
import { env } from "@/config/env";
import { ROLE_LABELS } from "@/config/roles";
import { requireActor, type Actor } from "@/lib/auth/actor";
import { prisma } from "@/lib/database/client";
import { formatDateTime } from "@/lib/utils";
import { classScopeWhere } from "@/modules/classes/class.repository";
import { resolveParentContext } from "@/modules/dashboard/parent-context";

export const dynamic = "force-dynamic";

type Tone = "navy" | "blue" | "green" | "amber" | "red";
type DashboardStat = {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
};

type UpcomingSession = {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  mode: "ONLINE" | "OFFLINE" | "HYBRID";
  room: string | null;
  meetingUrl: string | null;
  attendanceOpen: boolean;
  courseClass: { code: string; name: string };
};

function percentage(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function formatBytes(value: bigint | null | undefined) {
  const bytes = Number(value ?? 0);
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[index]}`;
}

function joinOpen(session: Pick<UpcomingSession, "startAt" | "endAt">) {
  const now = Date.now();
  return (
    now >=
      session.startAt.getTime() - env.ATTENDANCE_EARLY_MINUTES * 60_000 &&
    now <= session.endAt.getTime()
  );
}

function vietnamDayRange(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "01";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  return {
    start: new Date(`${date}T00:00:00+07:00`),
    end: new Date(`${date}T23:59:59.999+07:00`),
  };
}

async function getClassIds(actor: Actor, parentStudentId?: string) {
  const rows = await prisma.courseClass.findMany({
    where:
      actor.role === "PARENT" && parentStudentId
        ? {
            status: "ACTIVE",
            students: {
              some: { studentId: parentStudentId, status: "ACTIVE" },
            },
          }
        : classScopeWhere(actor),
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

async function getUpcomingSessions(classIds: string[], now: Date) {
  if (!classIds.length) return [] as UpcomingSession[];
  return prisma.classSession.findMany({
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
      meetingUrl: true,
      attendanceOpen: true,
      courseClass: { select: { code: true, name: true } },
    },
    orderBy: { startAt: "asc" },
    take: 5,
  });
}

async function getRoleStats(
  actor: Actor,
  classIds: string[],
  now: Date,
  studentId?: string,
): Promise<DashboardStat[]> {
  if (actor.role === "ADMIN") {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [
      activeUsers,
      activeClasses,
      overCapacity,
      pendingContents,
      failedJobs,
      storage,
      attendanceTotal,
      attendancePresent,
    ] = await Promise.all([
      prisma.user.count({
        where: { status: "ACTIVE", deletedAt: null },
      }),
      prisma.courseClass.count({ where: { status: "ACTIVE" } }),
      prisma.courseClass.count({
        where: { status: "ACTIVE", overCapacitySince: { not: null } },
      }),
      prisma.content.count({
        where: {
          deletedAt: null,
          publicationStatus: {
            in: ["PENDING_TEACHER_REVIEW", "REOPEN_REQUESTED"],
          },
        },
      }),
      prisma.job.count({ where: { status: "FAILED" } }),
      prisma.asset.aggregate({
        where: { status: "READY", deletedAt: null },
        _sum: { sizeBytes: true },
      }),
      prisma.attendance.count({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          status: { in: ["PRESENT", "LATE", "ABSENT", "EXCUSED"] },
        },
      }),
      prisma.attendance.count({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          status: { in: ["PRESENT", "LATE"] },
        },
      }),
    ]);
    return [
      { label: "Tài khoản hoạt động", value: activeUsers, hint: "Tài khoản ACTIVE", icon: UserCheck, tone: "navy" },
      { label: "Lớp hoạt động", value: activeClasses, hint: "Lớp ACTIVE", icon: School, tone: "blue" },
      { label: "Lớp vượt sức chứa", value: overCapacity, hint: "Cần xử lý sĩ số", icon: CircleAlert, tone: overCapacity ? "red" : "green" },
      { label: "Nội dung chờ xử lý", value: pendingContents, hint: "Duyệt hoặc mở lại", icon: BookOpenCheck, tone: pendingContents ? "amber" : "green" },
      { label: "Job lỗi", value: failedJobs, hint: "Job nền FAILED", icon: Database, tone: failedJobs ? "red" : "green" },
      { label: "Dung lượng lưu trữ", value: formatBytes(storage._sum.sizeBytes), hint: "Asset READY", icon: HardDrive, tone: "blue" },
      { label: "Tỷ lệ điểm danh", value: `${percentage(attendancePresent, attendanceTotal)}%`, hint: "30 ngày gần nhất", icon: ClipboardCheck, tone: "green" },
    ];
  }

  if (actor.role === "MANAGER") {
    const day = vietnamDayRange(now);
    const activeClassRows = await prisma.courseClass.findMany({
      where: { status: "ACTIVE" },
      select: {
        capacity: true,
        overCapacitySince: true,
        _count: { select: { students: { where: { status: "ACTIVE" } } } },
      },
    });
    const nearFull = activeClassRows.filter((row) => {
      if (row.capacity <= 0 || row.overCapacitySince) return false;
      return row._count.students / row.capacity >= 0.85;
    }).length;
    const overCapacity = activeClassRows.filter((row) => row.overCapacitySince).length;
    const [todaySessions, pendingContents, reopenRequests, submissions, attempts, failedJobs] =
      await Promise.all([
        prisma.classSession.count({
          where: { startAt: { gte: day.start, lte: day.end }, status: { not: "CANCELLED" } },
        }),
        prisma.content.count({
          where: { deletedAt: null, publicationStatus: "PENDING_TEACHER_REVIEW" },
        }),
        prisma.contentReopenRequest.count({ where: { status: "PENDING" } }),
        prisma.submission.count({ where: { status: { in: ["SUBMITTED", "GRADING"] } } }),
        prisma.quizAttempt.count({ where: { status: { in: ["SUBMITTED", "GRADING"] } } }),
        prisma.job.count({ where: { status: "FAILED" } }),
      ]);
    return [
      { label: "Lớp hoạt động", value: activeClassRows.length, hint: "Lớp ACTIVE", icon: School, tone: "blue" },
      { label: "Lớp gần đầy", value: nearFull, hint: "Từ 85% sức chứa", icon: Gauge, tone: nearFull ? "amber" : "green" },
      { label: "Lớp vượt sức chứa", value: overCapacity, hint: "Cần xử lý sĩ số", icon: CircleAlert, tone: overCapacity ? "red" : "green" },
      { label: "Lịch hôm nay", value: todaySessions, hint: "Theo giờ Việt Nam", icon: CalendarClock, tone: "navy" },
      { label: "Nội dung chờ xử lý", value: pendingContents, hint: "Chờ giáo viên duyệt", icon: BookOpenCheck, tone: pendingContents ? "amber" : "green" },
      { label: "Yêu cầu mở lại", value: reopenRequests, hint: "Đang chờ quyết định", icon: FileCheck2, tone: reopenRequests ? "amber" : "green" },
      { label: "Bài chờ chấm", value: submissions + attempts, hint: "Bài tập và quiz", icon: ListChecks, tone: submissions + attempts ? "amber" : "green" },
      { label: "Trạng thái vận hành", value: failedJobs ? `${failedJobs} lỗi` : "Ổn định", hint: "Theo job nền", icon: CheckCircle2, tone: failedJobs ? "red" : "green" },
    ];
  }

  if (actor.role === "TEACHER") {
    const [submissions, attempts, reviews, attendanceIncomplete, videoProgress] =
      await Promise.all([
        prisma.submission.count({
          where: {
            assignment: { content: { classId: { in: classIds } } },
            status: { in: ["SUBMITTED", "GRADING"] },
          },
        }),
        prisma.quizAttempt.count({
          where: {
            quiz: { content: { classId: { in: classIds } } },
            status: { in: ["SUBMITTED", "GRADING"] },
          },
        }),
        prisma.content.count({
          where: { classId: { in: classIds }, publicationStatus: "PENDING_TEACHER_REVIEW" },
        }),
        prisma.classSession.count({
          where: {
            classId: { in: classIds },
            status: { not: "CANCELLED" },
            endAt: { lt: now },
            attendanceClosedAt: null,
          },
        }),
        prisma.videoProgress.aggregate({
          where: { recording: { content: { classId: { in: classIds } } } },
          _avg: { percentage: true },
        }),
      ]);
    return [
      { label: "Lớp phụ trách", value: classIds.length, hint: "Phân công hiện tại", icon: GraduationCap, tone: "blue" },
      { label: "Bài chờ chấm", value: submissions + attempts, hint: "Bài tập và quiz", icon: ListChecks, tone: submissions + attempts ? "amber" : "green" },
      { label: "Nội dung TA chờ duyệt", value: reviews, hint: "PENDING_TEACHER_REVIEW", icon: BookOpenCheck, tone: reviews ? "amber" : "green" },
      { label: "Điểm danh chưa hoàn tất", value: attendanceIncomplete, hint: "Buổi đã kết thúc", icon: ClipboardCheck, tone: attendanceIncomplete ? "amber" : "green" },
      { label: "Tiến độ video trung bình", value: `${Math.round(Number(videoProgress._avg.percentage ?? 0))}%`, hint: "Học sinh trong lớp", icon: Video, tone: "navy" },
    ];
  }

  if (actor.role === "TEACHING_ASSISTANT") {
    const [drafts, changes, approved, submissions, attempts, attendanceIncomplete] =
      await Promise.all([
        prisma.content.count({ where: { creatorId: actor.id, publicationStatus: "DRAFT" } }),
        prisma.content.count({ where: { creatorId: actor.id, publicationStatus: "CHANGES_REQUESTED" } }),
        prisma.content.count({ where: { creatorId: actor.id, publicationStatus: "APPROVED" } }),
        prisma.submission.count({
          where: { assignment: { content: { classId: { in: classIds } } }, status: { in: ["SUBMITTED", "GRADING"] } },
        }),
        prisma.quizAttempt.count({
          where: { quiz: { content: { classId: { in: classIds } } }, status: { in: ["SUBMITTED", "GRADING"] } },
        }),
        prisma.classSession.count({
          where: { classId: { in: classIds }, status: { not: "CANCELLED" }, endAt: { lt: now }, attendanceClosedAt: null },
        }),
      ]);
    return [
      { label: "Lớp được giao", value: classIds.length, hint: "Phân công hiện tại", icon: GraduationCap, tone: "blue" },
      { label: "Nội dung đang soạn", value: drafts, hint: "DRAFT", icon: BookOpenCheck, tone: "navy" },
      { label: "Nội dung cần sửa", value: changes, hint: "CHANGES_REQUESTED", icon: CircleAlert, tone: changes ? "amber" : "green" },
      { label: "Nội dung đã duyệt", value: approved, hint: "Chờ xuất bản", icon: FileCheck2, tone: "green" },
      { label: "Bài cần hỗ trợ chấm", value: submissions + attempts, hint: "Chỉ đề xuất điểm", icon: ListChecks, tone: submissions + attempts ? "amber" : "green" },
      { label: "Điểm danh chưa hoàn tất", value: attendanceIncomplete, hint: "Buổi đã kết thúc", icon: ClipboardCheck, tone: attendanceIncomplete ? "amber" : "green" },
    ];
  }

  if (actor.role === "STUDENT") {
    const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [newContents, dueAssignments, openQuizzes, videosInProgress, videoProgress, assignmentResults, quizResults] =
      await Promise.all([
        prisma.content.count({
          where: { classId: { in: classIds }, publicationStatus: "PUBLISHED", deletedAt: null, publishedAt: { gte: sevenDaysAgo } },
        }),
        prisma.assignment.count({
          where: {
            content: { classId: { in: classIds }, publicationStatus: "PUBLISHED" },
            dueAt: { gte: now, lte: soon },
            submissions: { none: { studentId: actor.id, status: { in: ["SUBMITTED", "GRADING", "GRADED"] } } },
          },
        }),
        prisma.quiz.count({
          where: {
            content: { classId: { in: classIds }, publicationStatus: "PUBLISHED" },
            AND: [
              { OR: [{ opensAt: null }, { opensAt: { lte: now } }] },
              { OR: [{ closesAt: null }, { closesAt: { gte: now } }] },
            ],
          },
        }),
        prisma.videoProgress.count({ where: { userId: actor.id, completed: false } }),
        prisma.videoProgress.aggregate({ where: { userId: actor.id }, _avg: { percentage: true } }),
        prisma.submission.count({ where: { studentId: actor.id, publishedAt: { not: null } } }),
        prisma.quizAttempt.count({ where: { studentId: actor.id, publishedAt: { not: null } } }),
      ]);
    return [
      { label: "Nội dung mới", value: newContents, hint: "7 ngày gần nhất", icon: BookOpenCheck, tone: "blue" },
      { label: "Bài tập sắp hết hạn", value: dueAssignments, hint: "Trong 3 ngày tới", icon: CircleAlert, tone: dueAssignments ? "amber" : "green" },
      { label: "Quiz đang mở", value: openQuizzes, hint: "Theo thời gian server", icon: ListChecks, tone: openQuizzes ? "navy" : "green" },
      { label: "Video xem dở", value: videosInProgress, hint: "Chưa hoàn thành", icon: Video, tone: "blue" },
      { label: "Tiến độ video", value: `${Math.round(Number(videoProgress._avg.percentage ?? 0))}%`, hint: "Trung bình", icon: Gauge, tone: "green" },
      { label: "Điểm đã công bố", value: assignmentResults + quizResults, hint: "Bài tập và quiz", icon: CheckCircle2, tone: "green" },
    ];
  }

  const targetStudentId = studentId;
  if (!targetStudentId) {
    return [
      { label: "Học sinh liên kết", value: 0, hint: "Chưa có hồ sơ ACTIVE", icon: UsersRound, tone: "amber" },
    ];
  }

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [recentAttendance, missingAssignments, assignmentResults, quizResults, feedbackCount, videoProgress] =
    await Promise.all([
      prisma.attendance.count({
        where: { studentId: targetStudentId, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.assignment.count({
        where: {
          content: { classId: { in: classIds }, publicationStatus: "PUBLISHED" },
          dueAt: { lt: now },
          submissions: { none: { studentId: targetStudentId, status: { in: ["SUBMITTED", "GRADING", "GRADED"] } } },
        },
      }),
      prisma.submission.count({ where: { studentId: targetStudentId, publishedAt: { not: null } } }),
      prisma.quizAttempt.count({ where: { studentId: targetStudentId, publishedAt: { not: null } } }),
      prisma.submission.count({ where: { studentId: targetStudentId, publishedAt: { not: null }, teacherFeedback: { not: null } } }),
      prisma.videoProgress.aggregate({ where: { userId: targetStudentId }, _avg: { percentage: true } }),
    ]);
  return [
    { label: "Điểm danh gần đây", value: recentAttendance, hint: "30 ngày gần nhất", icon: ClipboardCheck, tone: "blue" },
    { label: "Bài chưa nộp", value: missingAssignments, hint: "Đã quá hạn", icon: CircleAlert, tone: missingAssignments ? "amber" : "green" },
    { label: "Kết quả đã công bố", value: assignmentResults + quizResults, hint: "Bài tập và quiz", icon: CheckCircle2, tone: "green" },
    { label: "Nhận xét giáo viên", value: feedbackCount, hint: "Bài tập đã công bố", icon: FileCheck2, tone: "navy" },
    { label: "Tiến độ video", value: `${Math.round(Number(videoProgress._avg.percentage ?? 0))}%`, hint: "Trung bình", icon: Gauge, tone: "green" },
  ];
}

function quickLinks(role: Actor["role"]) {
  const links: Record<Actor["role"], { label: string; href: string }[]> = {
    ADMIN: [
      { label: "Tài khoản", href: "/dashboard/users" },
      { label: "Lớp học", href: "/dashboard/classes" },
      { label: "Job lỗi", href: "/dashboard/jobs" },
      { label: "Nhật ký", href: "/dashboard/audit" },
    ],
    MANAGER: [
      { label: "Lớp học", href: "/dashboard/classes" },
      { label: "Buổi học", href: "/dashboard/sessions" },
      { label: "Chấm điểm", href: "/dashboard/grading" },
      { label: "Báo cáo", href: "/dashboard/reports" },
    ],
    TEACHER: [
      { label: "Buổi dạy", href: "/dashboard/sessions" },
      { label: "Duyệt nội dung", href: "/dashboard/reviews" },
      { label: "Chấm điểm", href: "/dashboard/grading" },
      { label: "Điểm danh", href: "/dashboard/attendance" },
    ],
    TEACHING_ASSISTANT: [
      { label: "Buổi học", href: "/dashboard/sessions" },
      { label: "Nội dung", href: "/dashboard/contents" },
      { label: "Chấm điểm", href: "/dashboard/grading" },
      { label: "Điểm danh", href: "/dashboard/attendance" },
    ],
    STUDENT: [
      { label: "Lớp học", href: "/dashboard/classes" },
      { label: "Bài tập", href: "/dashboard/assignments" },
      { label: "Bài kiểm tra", href: "/dashboard/quizzes" },
      { label: "Kết quả", href: "/dashboard/results" },
    ],
    PARENT: [
      { label: "Lịch học", href: "/dashboard/sessions" },
      { label: "Điểm danh", href: "/dashboard/attendance" },
      { label: "Kết quả", href: "/dashboard/results" },
      { label: "Tiến độ", href: "/dashboard/progress" },
    ],
  };
  return links[role];
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const actor = await requireActor();
  const query = await searchParams;
  const parentContext =
    actor.role === "PARENT"
      ? await resolveParentContext(actor, query.studentId)
      : null;
  const selectedStudentId = parentContext?.selectedStudentId ?? undefined;
  const now = new Date();
  const classIds = await getClassIds(actor, selectedStudentId);
  const [upcomingSessions, stats, recentAudit] = await Promise.all([
    getUpcomingSessions(classIds, now),
    getRoleStats(actor, classIds, now, selectedStudentId),
    actor.role === "ADMIN"
      ? prisma.auditLog.findMany({
          select: {
            id: true,
            action: true,
            createdAt: true,
            actor: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  const nextSession = upcomingSessions[0];
  const studentCanJoin =
    actor.role === "STUDENT" &&
    nextSession &&
    nextSession.mode !== "OFFLINE" &&
    joinOpen(nextSession);

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
            Tổng quan được điều chỉnh theo đúng quyền của vai trò hiện tại.
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

      {parentContext ? (
        <ParentChildSwitcher
          students={parentContext.children}
          selectedStudentId={parentContext.selectedStudentId}
          action="/dashboard"
        />
      ) : null}

      {actor.role === "STUDENT" && nextSession ? (
        <section className="mt-6 rounded-2xl border border-[#DDE3F0] bg-[#F7F8FC] p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#4059A5]">Buổi học tiếp theo</p>
            <h2 className="mt-2 text-lg font-semibold text-[#172033]">
              {nextSession.courseClass.code} · {nextSession.title}
            </h2>
            <p className="mt-1 text-sm text-[#667085]">{formatDateTime(nextSession.startAt)}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 sm:mt-0">
            <Link href={`/dashboard/sessions/${nextSession.id}`} className="inline-flex min-h-11 items-center rounded-xl border border-[#D0D5DD] bg-white px-4 text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB]">
              Xem buổi học
            </Link>
            {studentCanJoin ? (
              <Link href={`/student/sessions/${nextSession.id}/join`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#243467] px-4 text-sm font-semibold text-white hover:bg-[#17244D]">
                <DoorOpen className="size-4" aria-hidden="true" />
                Vào lớp
              </Link>
            ) : (
              <span className="inline-flex min-h-11 items-center rounded-xl bg-[#EAECF0] px-4 text-sm font-semibold text-[#667085]">
                Vào lớp mở trước {env.ATTENDANCE_EARLY_MINUTES} phút
              </span>
            )}
          </div>
        </section>
      ) : null}

      <section aria-label="Số liệu tổng quan" className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
        <section className="rounded-2xl border border-[#E4E7EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center justify-between border-b border-[#EAECF0] px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-semibold text-[#172033]">
                {actor.role === "TEACHER" ? "Buổi dạy tiếp theo" : "Lịch học sắp tới"}
              </h2>
              <p className="mt-1 text-xs text-[#667085]">5 buổi gần nhất trong phạm vi được phép</p>
            </div>
            <Link href="/dashboard/sessions" className="text-sm font-semibold text-[#4059A5] hover:text-[#243467]">
              Xem tất cả
            </Link>
          </div>
          <div className="divide-y divide-[#EAECF0]">
            {upcomingSessions.length ? (
              upcomingSessions.map((session) => (
                <article key={session.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <CalendarClock aria-hidden="true" className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#172033]">{session.title}</p>
                    <p className="mt-1 truncate text-xs text-[#667085]">{session.courseClass.code} · {formatDateTime(session.startAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/dashboard/sessions/${session.id}`} className="inline-flex min-h-10 items-center rounded-lg border border-[#D0D5DD] bg-white px-3 text-xs font-semibold text-[#344054] hover:bg-[#F9FAFB]">
                      Chi tiết
                    </Link>
                    {(["ADMIN", "MANAGER", "TEACHER", "TEACHING_ASSISTANT"] as Actor["role"][]).includes(actor.role) && session.meetingUrl ? (
                      <a href={session.meetingUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[#243467] px-3 text-xs font-semibold text-white hover:bg-[#17244D]">
                        <DoorOpen className="size-3.5" aria-hidden="true" />
                        Vào lớp
                      </a>
                    ) : null}
                    {session.attendanceOpen ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Đang điểm danh</span>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <p className="px-6 py-12 text-center text-sm text-[#667085]">Chưa có buổi học sắp tới.</p>
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl bg-[#243467] p-6 text-white shadow-sm">
            <span className="flex size-11 items-center justify-center rounded-xl bg-white/10">
              <CheckCircle2 aria-hidden="true" className="size-5" />
            </span>
            <h2 className="mt-5 text-lg font-semibold">Lối tắt theo vai trò</h2>
            <div className="mt-4 grid gap-2">
              {quickLinks(actor.role).map((item) => (
                <Link key={item.href} href={selectedStudentId ? `${item.href}?studentId=${selectedStudentId}` : item.href} className="rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/15">
                  {item.label}
                </Link>
              ))}
            </div>
          </section>

          {actor.role === "ADMIN" && recentAudit.length ? (
            <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5">
              <h2 className="text-sm font-semibold text-[#172033]">Hoạt động quản trị gần đây</h2>
              <div className="mt-3 divide-y divide-[#EAECF0]">
                {recentAudit.map((item) => (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-xs font-semibold text-[#344054]">{item.action}</p>
                    <p className="mt-1 text-xs text-[#667085]">{item.actor?.name ?? "Hệ thống"} · {formatDateTime(item.createdAt)}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
