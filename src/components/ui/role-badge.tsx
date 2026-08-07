import type { UserRole } from "@/generated/prisma/enums";
import { ROLE_LABELS } from "@/config/roles";

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className="inline-flex rounded-full bg-[#EDEEF3] px-2.5 py-1 text-xs font-semibold text-[#2C3D78]">
      {ROLE_LABELS[role]}
    </span>
  );
}
