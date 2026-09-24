"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  LoaderCircle,
  Maximize2,
  Minimize2,
  Play,
} from "lucide-react";

type PlaybackData = {
  streamUrl: string;
  viewSessionId: string;
  mimeType: string;
  watermark: {
    viewerName: string;
    viewerCode: string;
    maskedEmail: string;
    timestamp: string;
    sessionCode: string;
  };
};

type ApiEnvelope<T> =
  { success: true; data: T } | { success: false; error: { message: string } };

const watermarkPositions = [
  "top-5 left-5",
  "top-5 right-5",
  "bottom-16 right-5",
  "bottom-16 left-5",
  "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
];

export function ProtectedVideoPlayer({
  recordingId,
  trackProgress,
}: {
  recordingId: string;
  trackProgress: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [playback, setPlayback] = useState<PlaybackData>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [position, setPosition] = useState(0);
  const containerRef =
    useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] =
    useState(false);

  useEffect(() => {
    if (!playback) return;
    const timer = window.setInterval(
      () => setPosition((current) => (current + 1) % watermarkPositions.length),
      10_000,
    );
    return () => window.clearInterval(timer);
  }, [playback]);

  useEffect(() => {
    if (!playback || !trackProgress) return;
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || !Number.isFinite(video.duration)) return;
      void fetch(`/api/v1/videos/${recordingId}/progress`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          viewSessionId: playback.viewSessionId,
          currentTimeSeconds: video.currentTime,
          durationSeconds: video.duration,
          watchedDeltaSeconds: 20,
        }),
        keepalive: true,
      });
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [playback, recordingId, trackProgress]);

  useEffect(
    () => () => {
      hlsRef.current?.destroy();
    },
    [],
  );

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        document.fullscreenElement ===
        containerRef.current,
      );
    };

    document.addEventListener(
      "fullscreenchange",
      handleFullscreenChange,
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange,
      );
    };
  }, []);

  async function toggleFullscreen() {
    const container =
      containerRef.current;

    if (!container) return;

    if (
      document.fullscreenElement ===
      container
    ) {
      await document.exitFullscreen();
      return;
    }

    await container.requestFullscreen();
  }

  async function startPlayback() {
    setPending(true);
    setError(undefined);
    try {
      const storageKey =
        "lms-video-view-session";

      const existingViewSessionId =
        window.localStorage.getItem(
          storageKey,
        );

      const authorizeUrl =
        new URL(
          `/api/v1/videos/${recordingId}/authorize`,
          window.location.origin,
        );

      if (existingViewSessionId) {
        authorizeUrl.searchParams.set(
          "viewSessionId",
          existingViewSessionId,
        );
      }

      const response = await fetch(
        `${authorizeUrl.pathname}${authorizeUrl.search}`,
        {
          method: "POST",
          credentials: "same-origin",
        },
      );
      const result = (await response.json()) as ApiEnvelope<PlaybackData>;
      if (!result.success) throw new Error(result.error.message);
      window.localStorage.setItem(
        storageKey,
        result.data.viewSessionId,
      );
      const video = videoRef.current;
      if (!video) throw new Error("Không khởi tạo được trình phát.");

      hlsRef.current?.destroy();
      if (
        result.data.mimeType === "application/vnd.apple.mpegurl" &&
        Hls.isSupported()
      ) {
        const hls = new Hls({
          enableWorker: true,
          maxBufferLength: 30,
          xhrSetup: (xhr) => {
            xhr.withCredentials = true;
          },
        });
        hls.loadSource(result.data.streamUrl);
        hls.attachMedia(video);
        hlsRef.current = hls;
      } else {
        video.src = result.data.streamUrl;
      }
      setPlayback(result.data);
      await video.play();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể bắt đầu phát video.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <div
        ref={containerRef}
        className="relative aspect-video overflow-hidden rounded-2xl bg-[#101828] shadow-xl"
        onContextMenu={(event) =>
          event.preventDefault()
        }
      >
        <video
          ref={videoRef}
          controls={Boolean(playback)}
          controlsList="nodownload"
          disablePictureInPicture
          playsInline
          className="protected-video size-full bg-black object-contain"
        >
          Trình duyệt của bạn không hỗ trợ video HTML5.
        </video>

        {!playback ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,#25396f_0%,#101828_70%)] p-6 text-center">
            {/* <span className="flex size-16 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20">
              <Play aria-hidden="true" className="ml-1 size-7" />
            </span> */}
            <p className="mt-5 text-sm text-blue-100">
              Quyền truy cập sẽ được kiểm tra trước khi phát.
            </p>
            <button
              type="button"
              onClick={startPlayback}
              disabled={pending}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-[#243467] hover:bg-blue-50 disabled:opacity-70"
            >
              {pending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              {pending ? "Đang cấp quyền…" : "Phát video"}
            </button>
          </div>
        ) : null}

        {playback ? (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute z-10 rounded-lg bg-black/35 px-3 py-2 text-[10px] leading-4 text-white/75 backdrop-blur-[1px] transition-all duration-700 sm:text-xs ${watermarkPositions[position]}`}
          >
            <p className="font-semibold">{playback.watermark.viewerName}</p>
            <p>
              {playback.watermark.viewerCode} · {playback.watermark.maskedEmail}
            </p>
            <p>
              {new Date().toLocaleString("vi-VN")} ·{" "}
              {playback.watermark.sessionCode}
            </p>
          </div>
        ) : null}
        {playback ? (
          <button
            type="button"
            onClick={toggleFullscreen}
            className="absolute bottom-14 right-4 z-20 flex size-10 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur hover:bg-black/75"
            aria-label={
              isFullscreen
                ? "Thoát toàn màn hình"
                : "Toàn màn hình"
            }
          >
            {isFullscreen ? (
              <Minimize2 className="size-5" />
            ) : (
              <Maximize2 className="size-5" />
            )}
          </button>
        ) : null}
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}
      {/* <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#E4E7EC] bg-white p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#4059A5]" />
        <p className="text-xs leading-5 text-[#667085]">
          Video được cấp quyền theo phiên và gắn watermark động. Không thể ngăn
          tuyệt đối việc quay màn hình trên thiết bị người dùng.
        </p>
      </div> */}
    </section>
  );
}
