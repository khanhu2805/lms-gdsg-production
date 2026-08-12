import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";

import { env } from "@/config/env";
import { prisma } from "@/lib/database/client";

/**
 * Better Auth instance dành riêng cho integration/E2E.
 * Không import file này từ production routes.
 */
export const testAuth = betterAuth({
  appName: "LMS GDSG E2E",
  baseURL: process.env.E2E_BASE_URL?.trim() || "http://127.0.0.1:3000",
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
    transaction: true,
  }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "STUDENT",
        input: false,
      },
      status: {
        type: "string",
        required: true,
        defaultValue: "INACTIVE",
        input: false,
      },
      lockedAt: {
        type: "date",
        required: false,
        input: false,
      },
      deletedAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
  },
  advanced: {
    useSecureCookies: false,
    cookiePrefix: "lms-gdsg",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    },
    database: { generateId: "uuid", },
  },
  plugins: [testUtils()],
});
