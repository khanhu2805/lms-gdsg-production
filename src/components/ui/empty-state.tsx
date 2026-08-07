import { Inbox } from "lucide-react";

export function EmptyState({
  title = "Chưa có dữ liệu",
  description = "Dữ liệu sẽ xuất hiện tại đây khi có thông tin phù hợp.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#CBD0DC] bg-white px-6 py-14 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#EDEEF3] text-[#2C3D78]">
        <Inbox aria-hidden="true" className="size-6" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-[#172033]">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#667085]">
        {description}
      </p>
    </div>
  );
}
