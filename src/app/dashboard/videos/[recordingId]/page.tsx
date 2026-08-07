import { notFound } from "next/navigation";

import { ProtectedVideoPlayer } from "@/components/video/protected-video-player";
import { requireActor } from "@/lib/auth/actor";
import { assertClassAccess } from "@/lib/authorization/class-access";
import { prisma } from "@/lib/database/client";

export const dynamic = "force-dynamic";

export default async function VideoPage({
  params,
}: {
  params: Promise<{ recordingId: string }>;
}) {
  const actor = await requireActor();
  const { recordingId } = await params;
  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
    select: {
      id: true,
      processingStatus: true,
      durationSeconds: true,
      content: {
        select: {
          title: true,
          description: true,
          classId: true,
          publicationStatus: true,
          courseClass: { select: { code: true, name: true } },
          classSession: { select: { sessionNumber: true, title: true } },
        },
      },
    },
  });
  if (!recording) notFound();
  await assertClassAccess(actor, recording.content.classId);
  if (
    (actor.role === "STUDENT" || actor.role === "PARENT") &&
    recording.content.publicationStatus !== "PUBLISHED"
  ) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-medium text-[#4059A5]">
        {recording.content.courseClass.code} · Buổi{" "}
        {recording.content.classSession.sessionNumber}
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#172033] sm:text-3xl">
        {recording.content.title}
      </h1>
      {recording.content.description ? (
        <p className="mt-3 text-sm leading-6 text-[#667085]">
          {recording.content.description}
        </p>
      ) : null}
      <div className="mt-7">
        {recording.processingStatus === "READY" ? (
          <ProtectedVideoPlayer
            recordingId={recording.id}
            trackProgress={actor.role === "STUDENT"}
          />
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            Video đang được xử lý hoặc chưa sẵn sàng. Vui lòng quay lại sau.
          </div>
        )}
      </div>
    </div>
  );
}
