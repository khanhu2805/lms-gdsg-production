import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { StudentAssignmentPlayer } from "@/components/learner/student-assignment-player";
import { StudentQuizPlayer } from "@/components/learner/student-quiz-player";
import { ProtectedVideoPlayer } from "@/components/video/protected-video-player";
import { requireActor } from "@/lib/auth/actor";
import { prisma } from "@/lib/database/client";
import { getContentDetail } from "@/modules/contents/content.service";
import {
  ProtectedDocumentViewer,
} from "@/components/material/protected-document-viewer";

export const dynamic = "force-dynamic";

export default async function LearnerContentPage({ params }: { params: Promise<{ contentId: string }> }) {
  const actor = await requireActor();
  const profile =
    await prisma.profile.findUnique({
      where: {
        userId:
          actor.id,
      },
      select: {
        studentCode:
          true,

        parentCode:
          true,
      },
    });

  const watermark =
    [
      actor.name,

      profile?.studentCode ??
      profile?.parentCode ??
      actor.id
        .slice(0, 8)
        .toUpperCase(),

      actor.email,
    ]
      .filter(Boolean)
      .join(" • ");
  const { contentId } = await params;
  if (actor.role !== "STUDENT" && actor.role !== "PARENT") redirect(`/dashboard/contents/${contentId}`);

  let content;
  try { content = await getContentDetail(actor, contentId); } catch { notFound(); }
  if (!content || content.publicationStatus !== "PUBLISHED") notFound();

  const ids = await prisma.content.findUnique({ where: { id: contentId }, select: { assignment: { select: { id: true } }, quiz: { select: { id: true } } } });
  const payload = content.payload as Record<string, unknown> | null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href={`/dashboard/sessions/${content.classSessionId}`} className="text-sm font-semibold text-[#4059A5] hover:text-[#243467]">← Quay lại buổi học</Link>
      <header><p className="text-sm font-semibold text-[#4059A5]">{content.courseClass.code} · Buổi {content.classSession.sessionNumber}</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-[#172033] sm:text-3xl">{content.title}</h1>{content.description ? <p className="mt-3 text-sm leading-6 text-[#667085]">{content.description}</p> : null}</header>

      {content.type === "LESSON" && payload ? <article className="prose prose-slate max-w-none rounded-2xl border border-[#E4E7EC] bg-white p-5 sm:p-7"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{String(payload.markdownContent ?? "")}</ReactMarkdown></article> : null}

      {content.type ===
        "MATERIAL" &&
        payload ? (
        <section className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white">
          <div className="border-b border-[#E4E7EC] p-5 sm:p-6">
            <h2 className="font-semibold text-[#172033]">
              Tài liệu học tập
            </h2>

            <p className="mt-2 text-sm text-[#667085]">
              {String(
                payload.title ??
                content.title,
              )}
            </p>

            <p className="mt-2 text-xs text-[#98A2B3]">
              Tài liệu được bảo vệ và gắn thông tin người xem.
            </p>
          </div>

          {payload.previewStatus ===
            "READY" &&
            payload.materialId ? (
            <ProtectedDocumentViewer
              materialId={String(
                payload.materialId,
              )}
              watermark={
                watermark
              }
            />
          ) : (
            <div className="p-6 text-sm text-[#667085]">
              Tài liệu đang được xử lý.
            </div>
          )}
        </section>
      ) : null}

      {content.type === "VIDEO" && payload ? <ProtectedVideoPlayer recordingId={String(payload.recordingId)} trackProgress={actor.role === "STUDENT"} /> : null}

      {content.type === "ASSIGNMENT" && ids?.assignment ? actor.role === "STUDENT" ? <StudentAssignmentPlayer assignmentId={ids.assignment.id} /> : <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 text-sm text-[#667085]">Phụ huynh có thể xem thông tin bài tập và trạng thái/kết quả của học sinh, nhưng không thể làm bài thay học sinh.</section> : null}

      {content.type === "QUIZ" && ids?.quiz ? actor.role === "STUDENT" ? <StudentQuizPlayer quizId={ids.quiz.id} /> : <section className="rounded-2xl border border-[#E4E7EC] bg-white p-5 text-sm text-[#667085]">Phụ huynh có thể xem thông tin bài kiểm tra và kết quả đã công bố, nhưng không thể bắt đầu lượt làm bài.</section> : null}
    </div>
  );
}
