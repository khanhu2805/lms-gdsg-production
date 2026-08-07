import { redirect } from "next/navigation";

import { requireActor } from "@/lib/auth/actor";
import { getRequestContext } from "@/lib/security/request-context";
import { registerStudentJoin } from "@/modules/attendance/attendance.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const actor = await requireActor(request.headers);
  const { sessionId } = await params;
  const result = await registerStudentJoin(
    actor,
    sessionId,
    getRequestContext(request.headers),
  );
  redirect(result.meetingUrl);
}
