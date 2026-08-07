import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "navy",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "navy" | "blue" | "green" | "amber" | "red";
}) {
  const toneClasses = {
    navy: "bg-[#EDEEF3] text-[#2C3D78]",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };

  return (
    <article className="rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#667085]">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[#172033]">
            {value}
          </p>
          {hint ? <p className="mt-2 text-xs text-[#98A2B3]">{hint}</p> : null}
        </div>
        <span className={`rounded-xl p-2.5 ${toneClasses[tone]}`}>
          <Icon aria-hidden="true" className="size-5" />
        </span>
      </div>
    </article>
  );
}
