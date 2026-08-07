import { randomUUID } from "node:crypto";

export type RequestContext = {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
};

export function getRequestContext(headers: Headers): RequestContext {
  const forwardedFor = headers.get("x-forwarded-for");
  const ipAddress =
    headers.get("x-real-ip") ?? forwardedFor?.split(",")[0]?.trim() ?? null;

  return {
    requestId: headers.get("x-request-id") ?? randomUUID(),
    ipAddress,
    userAgent: headers.get("user-agent"),
  };
}
