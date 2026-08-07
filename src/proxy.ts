import { NextRequest, NextResponse } from "next/server";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function proxy(request: NextRequest) {
  if (!MUTATING_METHODS.has(request.method)) return NextResponse.next();

  const origin = request.headers.get("origin");
  if (!origin) return NextResponse.next();

  const trustedOrigins = new Set([
    request.nextUrl.origin,
    process.env.NEXT_PUBLIC_APP_URL,
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ?? []),
  ]);
  const normalizedOrigin = origin.replace(/\/$/, "");
  const allowed = [...trustedOrigins]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim().replace(/\/$/, ""))
    .includes(normalizedOrigin);
  if (!allowed) {
    return Response.json(
      {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Nguồn gửi yêu cầu không được phép.",
        },
      },
      { status: 403 },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/v1/:path*",
};
