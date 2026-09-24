"use client";

import {
  useEffect,
  useState,
} from "react";

type Page = {
  page: number;
  url: string;
};

export function ProtectedDocumentViewer({
  materialId,
  watermark,
}: {
  materialId: string;

  watermark: string;
}) {
  const [pages, setPages] =
    useState<Page[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string>();

  useEffect(() => {
    let cancelled =
      false;

    async function load() {
      try {
        const response =
          await fetch(
            `/api/v1/materials/${materialId}/pages`,
            {
              credentials:
                "same-origin",
            },
          );

        const result =
          await response.json();

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result?.error
              ?.message ??
              "Không tải được tài liệu.",
          );
        }

        if (!cancelled) {
          setPages(
            result.data.pages,
          );
        }
      } catch (error) {
        if (!cancelled) {
          setError(
            error instanceof
              Error
              ? error.message
              : "Không tải được tài liệu.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(
            false,
          );
        }
      }
    }

    void load();

    return () => {
      cancelled =
        true;
    };
  }, [materialId]);

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-[#667085]">
        Đang tải tài liệu…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div
      className="space-y-5 bg-[#F2F4F7] p-4 sm:p-6"
      onContextMenu={(
        event,
      ) =>
        event.preventDefault()
      }
    >
      {pages.map(
        (page) => (
          <article
            key={
              page.page
            }
            className="relative mx-auto max-w-5xl overflow-hidden bg-white shadow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                page.url
              }
              alt={`Trang ${page.page}`}
              draggable={
                false
              }
              className="block h-auto w-full select-none"
            />

            <div className="pointer-events-none absolute inset-0 grid grid-cols-2 grid-rows-3 overflow-hidden">
              {Array.from({
                length:
                  6,
              }).map(
                (
                  _,
                  index,
                ) => (
                  <div
                    key={
                      index
                    }
                    className="flex items-center justify-center overflow-hidden"
                  >
                    <span className="-rotate-[25deg] whitespace-nowrap text-sm font-semibold text-[#172033]/20">
                      {
                        watermark
                      }
                    </span>
                  </div>
                ),
              )}
            </div>

            <span className="pointer-events-none absolute bottom-3 right-3 rounded bg-black/50 px-2 py-1 text-xs text-white">
              Trang{" "}
              {
                page.page
              }
            </span>
          </article>
        ),
      )}
    </div>
  );
}