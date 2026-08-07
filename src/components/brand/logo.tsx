import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandLogo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Image
      src="/brand/logo.svg"
      alt="LMS GDSG"
      width={compact ? 44 : 180}
      height={compact ? 44 : 54}
      priority
      className={cn(
        "h-auto object-contain",
        compact ? "w-11" : "w-[180px]",
        className,
      )}
    />
  );
}
