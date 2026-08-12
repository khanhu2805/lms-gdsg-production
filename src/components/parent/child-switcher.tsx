import { UsersRound } from "lucide-react";

import type { ParentChildOption } from "@/modules/dashboard/parent-context";

export function ParentChildSwitcher({
  students,
  selectedStudentId,
  action,
  search,
  pageSize,
}: {
  students: ParentChildOption[];
  selectedStudentId: string | null;
  action: string;
  search?: string;
  pageSize?: number;
}) {
  if (!students.length) return null;

  return (
    <section className="mt-6 rounded-2xl border border-[#DDE3F0] bg-[#F7F8FC] p-4 sm:p-5">
      <form method="get" action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="studentId" className="flex items-center gap-2 text-sm font-semibold text-[#172033]">
            <UsersRound className="size-4 text-[#4059A5]" aria-hidden="true" />
            Hồ sơ học sinh đang xem
          </label>
          <select
            id="studentId"
            name="studentId"
            defaultValue={selectedStudentId ?? undefined}
            className="mt-2 h-11 w-full rounded-xl border border-[#D0D5DD] bg-white px-3 text-sm text-[#344054] sm:max-w-md"
          >
            {students.map((child) => (
              <option key={child.id} value={child.id}>
                {child.name}
                {child.studentCode ? ` · ${child.studentCode}` : ""}
                {child.isPrimary ? " · chính" : ""}
              </option>
            ))}
          </select>
        </div>
        {search ? <input type="hidden" name="q" value={search} /> : null}
        {pageSize ? <input type="hidden" name="pageSize" value={pageSize} /> : null}
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#243467] px-4 text-sm font-semibold text-white hover:bg-[#17244D]"
        >
          Xem hồ sơ
        </button>
      </form>
    </section>
  );
}
