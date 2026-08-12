import Link from "next/link";
import { BookOpen, ChevronLeft, Clock3, DoorOpen } from "lucide-react";

import { env } from "@/config/env";
import type { Actor } from "@/lib/auth/actor";
import { assertClassAccess } from "@/lib/authorization/class-access";
import { prisma } from "@/lib/database/client";
import { formatDateTime } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = { LESSON: "Bài học", VIDEO: "Video", MATERIAL: "Tài liệu", ASSIGNMENT: "Bài tập", QUIZ: "Bài kiểm tra" };

function joinOpen(startAt: Date, endAt: Date, status: string) {
  if (status === "CANCELLED") return false;
  const now = Date.now();
  return now >= startAt.getTime() - env.ATTENDANCE_EARLY_MINUTES * 60_000 && now <= endAt.getTime();
}

export async function LearnerSessionDetail({ actor, sessionId }: { actor: Actor; sessionId: string }) {
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true, classId: true, sessionNumber: true, title: true, description: true, plannedContent: true,
      startAt: true, endAt: true, mode: true, room: true, status: true,
      courseClass: { select: { id: true, code: true, name: true, status: true } },
      contents: {
        where: { publicationStatus: "PUBLISHED", deletedAt: null },
        select: { id: true, type: true, title: true, description: true, publishedAt: true },
        orderBy: [{ type: "asc" }, { publishedAt: "asc" }],
      },
    },
  });
  if (!session || session.courseClass.status !== "ACTIVE") return null;
  await assertClassAccess(actor, session.classId);
  const canJoin = actor.role === "STUDENT" && session.mode !== "OFFLINE" && joinOpen(session.startAt, session.endAt, session.status);

  return (
    <div className="space-y-6">
      <Link href={`/dashboard/classes/${session.classId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-[#4059A5] hover:text-[#243467]"><ChevronLeft className="size-4" /> Quay lại lớp {session.courseClass.code}</Link>
      <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 sm:p-6">
        <p className="text-sm font-semibold text-[#4059A5]">{session.courseClass.code} · Buổi {session.sessionNumber}</p>
        <h1 className="mt-2 text-2xl font-bold text-[#172033] sm:text-3xl">{session.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#667085]"><span className="inline-flex items-center gap-1.5"><Clock3 className="size-4" /> {formatDateTime(session.startAt)}</span><span>– {formatDateTime(session.endAt)}</span><span>· {session.mode === "ONLINE" ? "Trực tuyến" : session.mode === "OFFLINE" ? (session.room ?? "Trực tiếp") : "Kết hợp"}</span></div>
        {session.description ? <p className="mt-4 text-sm leading-6 text-[#667085]">{session.description}</p> : null}
        {session.plannedContent ? <div className="mt-4 rounded-xl bg-[#F7F8FC] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Nội dung dự kiến</p><p className="mt-2 text-sm leading-6 text-[#344054]">{session.plannedContent}</p></div> : null}
        {actor.role === "STUDENT" ? (
          <div className="mt-5">
            {canJoin ? <Link href={`/student/sessions/${session.id}/join`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#243467] px-4 text-sm font-semibold text-white hover:bg-[#17244D]"><DoorOpen className="size-4" /> Vào lớp</Link> : <span className="inline-flex min-h-11 items-center rounded-xl bg-[#F2F4F7] px-4 text-sm font-semibold text-[#667085]">Nút Vào lớp mở từ {env.ATTENDANCE_EARLY_MINUTES} phút trước giờ học</span>}
            <p className="mt-2 text-xs leading-5 text-[#667085]">Việc nhấn “Vào lớp” chỉ ghi nhận thời điểm bạn mở phòng học; không chứng minh toàn bộ thời lượng tham gia.</p>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[#E4E7EC] bg-white">
        <div className="border-b border-[#EAECF0] px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><BookOpen className="size-5 text-[#4059A5]" /><h2 className="text-lg font-semibold text-[#172033]">Nội dung buổi học</h2></div></div>
        <div className="divide-y divide-[#EAECF0]">
          {session.contents.map((content) => <article key={content.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">{TYPE_LABEL[content.type] ?? content.type}</p><p className="mt-1 text-sm font-semibold text-[#172033]">{content.title}</p>{content.description ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#667085]">{content.description}</p> : null}</div><Link href={`/dashboard/learn/${content.id}`} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#D0D5DD] bg-white px-3.5 text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB]">Mở nội dung</Link></article>)}
          {!session.contents.length ? <p className="px-6 py-10 text-center text-sm text-[#667085]">Chưa có nội dung được xuất bản cho buổi học này.</p> : null}
        </div>
      </section>
    </div>
  );
}
