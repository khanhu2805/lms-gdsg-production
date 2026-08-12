import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

function buildHref(
  basePath: string,
  page: number,
  pageSize: number,
  params: Record<string, string | undefined>,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  if (page > 1) query.set("page", String(page));
  if (pageSize !== 20) query.set("pageSize", String(pageSize));
  const suffix = query.toString();
  return suffix ? `${basePath}?${suffix}` : basePath;
}

export function Pagination({
  basePath,
  page,
  pageSize,
  hasNext,
  params = {},
}: {
  basePath: string;
  page: number;
  pageSize: number;
  hasNext: boolean;
  params?: Record<string, string | undefined>;
}) {
  if (page === 1 && !hasNext) return null;

  return (
    <nav aria-label="Phân trang" className="mt-4 flex flex-col gap-3 rounded-xl border border-[#EAECF0] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-[#667085]">
        Trang <span className="font-semibold text-[#344054]">{page}</span> · {pageSize} mục/trang
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={buildHref(basePath, page - 1, pageSize, params)}
            className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB]"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Trước
          </Link>
        ) : (
          <span className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#EAECF0] bg-[#F9FAFB] px-3 text-sm font-semibold text-[#98A2B3]">
            <ChevronLeft className="size-4" aria-hidden="true" />
            Trước
          </span>
        )}
        {hasNext ? (
          <Link
            href={buildHref(basePath, page + 1, pageSize, params)}
            className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm font-semibold text-[#344054] hover:bg-[#F9FAFB]"
          >
            Sau
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        ) : (
          <span className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#EAECF0] bg-[#F9FAFB] px-3 text-sm font-semibold text-[#98A2B3]">
            Sau
            <ChevronRight className="size-4" aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  );
}
