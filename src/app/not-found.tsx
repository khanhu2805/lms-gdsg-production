import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F7FB] p-6">
      <section className="max-w-lg text-center">
        <p className="text-sm font-semibold text-[#4F6FCF]">404</p>
        <h1 className="mt-3 text-3xl font-bold text-[#172033]">
          Không tìm thấy trang
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#667085]">
          Liên kết có thể đã thay đổi hoặc bạn không có quyền truy cập.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-xl bg-[#243467] px-5 py-3 text-sm font-semibold text-white"
        >
          Về trang tổng quan
        </Link>
      </section>
    </main>
  );
}
