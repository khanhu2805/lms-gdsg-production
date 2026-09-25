import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandLogo({
  compact = false,
  className,
  textClassName,
}: {
  compact?: boolean;
  className?: string;
  textClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center",
        compact ? "gap-0" : "gap-1.5",
        className,
      )}
    >
      <Image
        src="/brand/logo.svg"
        alt="Luyện thi Giáo dục Sài Gòn"
        width={compact ? 44 : 180}
        height={compact ? 44 : 54}
        priority
        className={cn(
          "h-auto object-contain",
          compact ? "w-11" : "w-[180px]",
        )}
      />

      {!compact ? (
        <span
          className={cn(
            "whitespace-nowrap text-center text-[11px] font-semibold tracking-[0.02em]",
            textClassName,
          )}
        >
          Luyện thi Giáo dục Sài Gòn
        </span>
      ) : null}
    </div>
  );
}