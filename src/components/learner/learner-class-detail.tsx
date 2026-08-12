import Link from "next/link";
import { CalendarDays, ChevronLeft, Clock3, UserRound } from "lucide-react";

import { env } from "@/config/env";
import type { Actor } from "@/lib/auth/actor";
import { assertClassAccess } from "@/lib/authorization/class-access";
import { prisma } from "@/lib/database/client";
import { formatDate, formatDateTime } from "@/lib/utils";

function sessionJoinOpen(startAt: Date, endAt: Date, status: string) {
  if (status === "CANCELLED") return false;
  const now = Date.now();
  const opensAt = startAt.getTime() - env.ATTENDANCE_EARLY_MINUTES * 60_000;
  return now >= opensAt && now <= endAt.getTime();
}

export async function LearnerClassDetail({ actor, classId }: { actor: Actor; classId: string }) {
  await assertClassAccess(actor, classId);
  const courseClass = await prisma.courseClass.findFirst({
    where: { id: classId, status: "ACTIVE" },
    select: {
      id: true,
      code: true,
      name: true,
      academicYear: true,
      startDate: true,
      endDate: true,
      mode: true,
      description: true,
      subject: { select: { code: true, name: true } },
      teachers: {
        where: { status: "ACTIVE" },
        select: { type: true, teacher: { select: { id: true, name: true } } },
        orderBy: [{ type: "asc" }, { assignedAt: "asc" }],
      },
      sessions: {
        where: { status: { not: "CANCELLED" } },
        select: { id: true, sessionNumber: true, title: true, startAt: true, endAt: true, mode: true, room: true, status: true },
        orderBy: { sessionNumber: "asc" },
      },
    },
  });
  if (!courseClass) return null;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/classes" className="inline-flex items-center gap-1 text-sm font-semibold text-[#4059A5] hover:text-[#243467]">
        <ChevronLeft className="size-4" /> Quay lại lớp học
      </Link>

      <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#4059A5]">{courseClass.subject.code} · {courseClass.code}</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#172033] sm:text-3xl">{courseClass.name}</h1>
            {courseClass.description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-[#667085]">{courseClass.description}</p> : null}
          </div>
          <span className="inline-flex self-start rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">Đang học</span>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-xs font-medium text-[#667085]">Môn học</dt><dd className="mt-1 text-sm font-semibold text-[#172033]">{courseClass.subject.name}</dd></div>
          <div><dt className="text-xs font-medium text-[#667085]">Năm học</dt><dd className="mt-1 text-sm font-semibold text-[#172033]">{courseClass.academicYear}</dd></div>
          <div><dt className="text-xs font-medium text-[#667085]">Thời gian</dt><dd className="mt-1 text-sm font-semibold text-[#172033]">{formatDate(courseClass.startDate)} – {formatDate(courseClass.endDate)}</dd></div>
          <div><dt className="text-xs font-medium text-[#667085]">Hình thức</dt><dd className="mt-1 text-sm font-semibold text-[#172033]">{courseClass.mode === "ONLINE" ? "Trực tuyến" : courseClass.mode === "OFFLINE" ? "Trực tiếp" : "Kết hợp"}</dd></div>
        </dl>
      </section>

      <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3"><UserRound className="size-5 text-[#4059A5]" /><h2 className="text-lg font-semibold text-[#172033]">Giáo viên phụ trách</h2></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courseClass.teachers.map(({ teacher, type }) => (
            <div key={teacher.id} className="rounded-xl bg-[#F7F8FC] p-4">
              <p className="text-sm font-semibold text-[#172033]">{teacher.name}</p>
              <p className="mt-1 text-xs text-[#667085]">{type === "PRIMARY" ? "Giáo viên chính" : "Giáo viên phụ"}</p>
            </div>
          ))}
          {!courseClass.teachers.length ? <p className="text-sm text-[#667085]">Chưa cập nhật giáo viên phụ trách.</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-[#E4E7EC] bg-white">
        <div className="border-b border-[#EAECF0] px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><CalendarDays className="size-5 text-[#4059A5]" /><h2 className="text-lg font-semibold text-[#172033]">Các buổi học</h2></div><p className="mt-1 text-xs text-[#667085]">Mở từng buổi để xem bài học, video, tài liệu, bài tập và bài kiểm tra đã xuất bản.</p></div>
        <div className="divide-y divide-[#EAECF0]">
          {courseClass.sessions.map((session) => {
            const canJoin = actor.role === "STUDENT" && sessionJoinOpen(session.startAt, session.endAt, session.status) && session.mode !== "OFFLINE";
            return (
              <article key={session.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Clock3 className="size-5" /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#172033]">Buổi {session.sessionNumber}: {session.title}</p><p className="mt-1 text-xs text-[#667085]">{formatDateTime(session.startAt)} · {session.mode === "ONLINE" ? "Trực tuyến" : session.mode === "OFFLINE" ? (session.room ?? "Trực tiếp") : "Kết hợp"}</p></div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/dashboard/sessions/${session.id}`} className="inline-flex min-h-10 items-center rounded-xl border border-[#D0D5DD] bg-white px-3.5 text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB]">Xem buổi học</Link>
                  {canJoin ? <Link href={`/student/sessions/${session.id}/join`} className="inline-flex min-h-10 items-center rounded-xl bg-[#243467] px-3.5 text-sm font-semibold text-white hover:bg-[#17244D]">Vào lớp</Link> : null}
                </div>
              </article>
            );
          })}
          {!courseClass.sessions.length ? <p className="px-6 py-10 text-center text-sm text-[#667085]">Chưa có buổi học.</p> : null}
        </div>
      </section>
    </div>
  );
}
