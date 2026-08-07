"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";

import { authClient } from "@/lib/auth/auth-client";

export function GoogleSignIn() {
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string>();

  async function signIn() {
    setIsPending(true);
    setMessage(undefined);

    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
      errorCallbackURL: "/?authError=1",
    });

    if (result?.error) {
      setMessage(
        "Không thể đăng nhập. Hãy dùng đúng tài khoản đã được quản trị viên cấp.",
      );
      setIsPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={signIn}
        disabled={isPending}
        className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#D0D5DD] bg-white px-4 text-sm font-semibold text-[#344054] shadow-sm transition hover:border-[#98A2B3] hover:bg-[#F9FAFB] disabled:cursor-wait disabled:opacity-70"
      >
        {isPending ? (
          <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
            <path
              fill="#4285F4"
              d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.32 2.98-7.4Z"
            />
            <path
              fill="#34A853"
              d="M12 22c2.7 0 4.98-.9 6.63-2.43l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
            />
            <path
              fill="#FBBC05"
              d="M6.39 13.87A6 6 0 0 1 6.08 12c0-.65.11-1.28.31-1.87V7.51H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.49l3.35-2.62Z"
            />
            <path
              fill="#EA4335"
              d="M12 6.01c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.51l3.35 2.62C7.18 7.77 9.39 6.01 12 6.01Z"
            />
          </svg>
        )}
        {isPending ? "Đang chuyển hướng…" : "Tiếp tục với Google"}
      </button>
      {message ? (
        <p role="alert" className="mt-3 text-sm leading-6 text-red-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}
