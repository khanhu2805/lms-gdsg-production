"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  LoaderCircle,
  Maximize2,
  Minimize2,
  Pause,
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
  | { success: true; data: T }
  | { success: false; error: { message: string } };

const watermarkPositions = [
  "top-4 left-4",
  "top-4 right-4",
  "bottom-16 right-4",
  "bottom-16 left-4",
  "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
];

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";

  const seconds = Math.floor(value);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

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
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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
    if (!isExpanded) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isExpanded]);

  async function togglePlay() {
    const video = videoRef.current;
    if (!video || !playback) return;

    if (video.paused) {
      await video.play();
    } else {
      video.pause();
    }
  }

  function seekTo(value: number) {
    const video = videoRef.current;
    if (!video || !Number.isFinite(value)) return;

    video.currentTime = value;
    setCurrentTime(value);
  }

  function toggleExpanded() {
    setIsExpanded((current) => !current);
  }

  async function startPlayback() {
    setPending(true);
    setError(undefined);
    try {
      const storageKey = "lms-video-view-session";
      const existingViewSessionId =
        window.localStorage.getItem(storageKey);

      const authorizeUrl = new URL(
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
        className={
          isExpanded
            ? "fixed inset-0 z-[100] h-screen w-screen overflow-hidden bg-black supports-[height:100dvh]:h-[100dvh]"
            : "relative aspect-video overflow-hidden rounded-2xl bg-[#101828] shadow-xl"
        }
        onContextMenu={(event) => event.preventDefault()}
      >
        <video
          ref={videoRef}
          controls={false}
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture
          disableRemotePlayback
          playsInline
          preload="metadata"
          onClick={() => {
            if (playback) void togglePlay();
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onLoadedMetadata={(event) => {
            setDuration(
              Number.isFinite(event.currentTarget.duration)
                ? event.currentTarget.duration
                : 0,
            );
          }}
          onDurationChange={(event) => {
            setDuration(
              Number.isFinite(event.currentTarget.duration)
                ? event.currentTarget.duration
                : 0,
            );
          }}
          onTimeUpdate={(event) => {
            setCurrentTime(event.currentTarget.currentTime);
          }}
          className="protected-video size-full bg-black object-contain"
        >
          Trình duyệt của bạn không hỗ trợ video HTML5.
        </video>

        {!playback ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,#25396f_0%,#101828_70%)] p-6 text-center">
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
            className={`pointer-events-none absolute z-10 max-w-[75%] rounded-md bg-black/30 px-2 py-1 text-[10px] font-semibold leading-4 text-white/70 transition-all duration-700 sm:text-xs ${watermarkPositions[position]}`}
          >
            {playback.watermark.viewerCode} · Luyện thi Giáo dục Sài Gòn
          </div>
        ) : null}

        {playback ? (
          <div className="absolute inset-x-0 bottom-0 z-30 flex items-center gap-2 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-3 pb-3 pt-8 text-white sm:gap-3 sm:px-4">
            <button
              type="button"
              onClick={() => void togglePlay()}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
              aria-label={isPlaying ? "Tạm dừng" : "Phát video"}
            >
              {isPlaying ? (
                <Pause className="size-4" />
              ) : (
                <Play className="ml-0.5 size-4" />
              )}
            </button>

            <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-white/80 sm:text-xs">
              {formatTime(currentTime)}
            </span>

            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 0}
              step={0.1}
              value={Math.min(currentTime, duration > 0 ? duration : 0)}
              disabled={duration <= 0}
              onChange={(event) => seekTo(Number(event.currentTarget.value))}
              aria-label="Tua video"
              className="min-w-0 flex-1 cursor-pointer accent-white disabled:cursor-default"
            />

            <span className="w-10 shrink-0 text-[10px] tabular-nums text-white/80 sm:text-xs">
              {formatTime(duration)}
            </span>

            <button
              type="button"
              onClick={toggleExpanded}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
              aria-label={isExpanded ? "Thu nhỏ video" : "Mở rộng video"}
            >
              {isExpanded ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </button>
          </div>
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
    </section>
  );
}
