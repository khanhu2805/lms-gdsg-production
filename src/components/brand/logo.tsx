import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandLogo({
  compact = false,
  showName = true,
  className,
  textClassName,
}: {
  compact?: boolean;
  showName?: boolean;
  className?: string;
  textClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        showName && !compact ? "gap-1.5" : "gap-0",
        className,
      )}
    >
      <Image
        src="/brand/logo.svg"
        alt="Luyện thi Giáo dục Sài Gòn"
        width={64}
        height={64}
        priority
        className={cn(
          "shrink-0 object-contain",
          compact ? "size-10" : "size-14",
        )}
      />

      {showName && !compact ? (
        <span
          className={cn(
            "whitespace-nowrap text-center text-[11px] font-semibold leading-4 tracking-[0.01em]",
            textClassName,
          )}
        >
          Luyện thi Giáo dục Sài Gòn
        </span>
      ) : null}
    </div>
  );
}