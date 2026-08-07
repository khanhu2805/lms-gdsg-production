"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F7FB] p-6">
      <section className="max-w-lg rounded-2xl border border-[#E4E7EC] bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-red-700">ĐÃ CÓ LỖI XẢY RA</p>
        <h1 className="mt-3 text-2xl font-bold text-[#172033]">
          Không thể hoàn tất yêu cầu
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#667085]">
          Vui lòng thử lại. Nếu lỗi vẫn tiếp diễn, hãy gửi thời điểm xảy ra lỗi
          cho quản trị viên.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-xl bg-[#243467] px-5 py-3 text-sm font-semibold text-white hover:bg-[#17244D]"
        >
          Thử lại
        </button>
      </section>
    </main>
  );
}
