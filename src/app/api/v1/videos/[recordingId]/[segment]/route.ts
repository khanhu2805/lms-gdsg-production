import { z } from "zod";

import { requireActor } from "@/lib/auth/actor";
import { apiError } from "@/lib/errors/api-response";
import { getRequestContext } from "@/lib/security/request-context";
import { authorizeRecordingSegment } from "@/modules/recordings/recording.service";

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ recordingId: string; segment: string }>;
  },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { recordingId, segment } = await params;
    const viewSessionId = z
      .uuid()
      .parse(new URL(request.url).searchParams.get("viewSessionId"));
    const internalPath = await authorizeRecordingSegment(
      actor,
      recordingId,
      segment,
      viewSessionId,
    );
    return new Response(null, {
      status: 204,
      headers: {
        "X-Accel-Redirect": internalPath,
        "Content-Type": "video/mp2t",
        "Cache-Control": "private, max-age=30",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
