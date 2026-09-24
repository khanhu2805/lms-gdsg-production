import { readFile } from "node:fs/promises";

import { z } from "zod";

import { requireActor } from "@/lib/auth/actor";
import { apiError, apiSuccess } from "@/lib/errors/api-response";
import { getRequestContext } from "@/lib/security/request-context";
import { resolveProtectedStoragePath } from "@/lib/storage/file-policy";
import { authorizeRecordingPlayback } from "@/modules/recordings/recording.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ recordingId: string }> },
) {
  const context = getRequestContext(request.headers);
  try {
    const actor = await requireActor(request.headers);
    const { recordingId } = await params;
    const existingViewSessionId = z
      .uuid()
      .optional()
      .parse(
        new URL(request.url).searchParams.get("viewSessionId") ?? undefined,
      );
    const playback = await authorizeRecordingPlayback(
      actor,
      recordingId,
      context,
      existingViewSessionId,
    );
    if (playback.hlsManifestKey) {
      const rawManifest = await readFile(
        resolveProtectedStoragePath(playback.hlsManifestKey),
        "utf8",
      );
      const manifest = rawManifest.replace(
        /^(segment-\d{5}\.ts)$/gm,
        `$1?viewSessionId=${encodeURIComponent(playback.viewSessionId)}`,
      );
      return new Response(manifest, {
        status: 200,
        headers: {
          "Content-Type": playback.mimeType,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "X-Video-View-Session": playback.viewSessionId,
          "X-Watermark-Data": Buffer.from(
            JSON.stringify(playback.watermark),
          ).toString("base64url"),
        },
      });
    }
    return new Response(null, {
      status: 204,
      headers: {
        "X-Accel-Redirect": playback.internalPath,
        "Content-Type": playback.mimeType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Video-View-Session": playback.viewSessionId,
        "X-Watermark-Data": Buffer.from(
          JSON.stringify(playback.watermark),
        ).toString("base64url"),
      },
    });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      recordingId: string;
    }>;
  },
) {
  const context = getRequestContext(request.headers);

  try {
    const actor = await requireActor(request.headers);

    const { recordingId } = await params;

    const existingViewSessionId = z
      .uuid()
      .optional()
      .parse(
        new URL(request.url).searchParams.get("viewSessionId") ?? undefined,
      );

    const playback = await authorizeRecordingPlayback(
      actor,
      recordingId,
      context,
      existingViewSessionId,
    );

    return apiSuccess({
      streamUrl: `/api/v1/videos/${recordingId}/authorize?viewSessionId=${encodeURIComponent(
        playback.viewSessionId,
      )}`,

      viewSessionId: playback.viewSessionId,

      mimeType: playback.mimeType,

      watermark: playback.watermark,
    });
  } catch (error) {
    return apiError(error, context.requestId);
  }
}
