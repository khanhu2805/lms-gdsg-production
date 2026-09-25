import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BookOpenCheck, LockKeyhole, ShieldCheck } from "lucide-react";

import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { BrandLogo } from "@/components/brand/logo";
import { auth } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ authError?: string }>;
}) {
  const [session, query] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    searchParams,
  ]);

  if (session?.user) redirect("/dashboard");

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
      <section className="surface-grid relative hidden overflow-hidden bg-[#243467] px-12 py-10 text-white lg:flex lg:flex-col">
        <BrandLogo textClassName="text-white/90" />
        <div className="my-auto max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold tracking-wide">
            <ShieldCheck aria-hidden="true" className="size-4" />
            NỀN TẢNG HỌC TẬP NỘI BỘ
          </span>
          <h1 className="mt-7 text-5xl leading-[1.18] font-bold tracking-[-0.035em]">
            Một không gian học tập rõ ràng, an toàn và liền mạch.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-blue-100">
            Quản lý lớp, nội dung, điểm danh, bài tập và tiến độ trên một hệ
            thống được vận hành hoàn toàn trong hạ tầng của đơn vị.
          </p>
          <div className="mt-10 grid max-w-xl grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <BookOpenCheck className="size-6 text-blue-200" />
              <p className="mt-4 text-sm font-semibold">Học tập tập trung</p>
              <p className="mt-1 text-xs leading-5 text-blue-100">
                Nội dung, lịch học và kết quả ở cùng một nơi.
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <LockKeyhole className="size-6 text-blue-200" />
              <p className="mt-4 text-sm font-semibold">Dữ liệu được bảo vệ</p>
              <p className="mt-1 text-xs leading-5 text-blue-100">
                Kiểm soát truy cập theo vai trò và phạm vi lớp.
              </p>
            </div>
          </div>
        </div>
        <p className="text-xs text-blue-200">
          © {new Date().getFullYear()} Luyện thi Giáo dục Sài Gòn
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-white px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          <BrandLogo
            className="mb-12 lg:hidden"
            textClassName="text-[#243467]"
          />
          <p className="text-sm font-semibold text-[#4F6FCF]">CHÀO MỪNG</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#172033]">
            Đăng nhập hệ thống học tập
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#667085]">
            Sử dụng tài khoản Google đã được quản trị viên tạo sẵn. Hệ thống
            không hỗ trợ tự đăng ký.
          </p>
          {query.authError ? (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
            >
              Tài khoản chưa được cấp quyền hoặc đang bị khóa. Vui lòng liên hệ
              quản trị viên.
            </div>
          ) : null}
          <div className="mt-8">
            <GoogleSignIn />
          </div>
          <div className="mt-8 flex items-start gap-3 rounded-xl bg-[#F4F6FB] p-4">
            <LockKeyhole
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-[#2C3D78]"
            />
            <p className="text-xs leading-5 text-[#667085]">
              Bằng việc tiếp tục, bạn xác nhận chỉ sử dụng hệ thống cho mục đích
              công việc và học tập được phân quyền.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
