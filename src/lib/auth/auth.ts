import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { env } from "@/config/env";
import { prisma } from "@/lib/database/client";
import { logger } from "@/lib/logger";
import { encryptAccountTokens } from "@/lib/security/token-encryption";

export const auth = betterAuth({
  appName: "LMS GDSG",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
    transaction: true,
  }),
  emailAndPassword: {
    enabled: false,
    disableSignUp: true,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      accessType: "online",
      disableSignUp: true,
      disableImplicitSignUp: true,
      prompt: "select_account",
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      disableImplicitLinking: false,
      trustedProviders: ["google"],
      requireLocalEmailVerified: true,
    },
  },
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
    freshAge: 60 * 60,
    cookieCache: {
      enabled: false,
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/social": {
        window: 60,
        max: 10,
      },
      "/callback/*": {
        window: 60,
        max: 20,
      },
    },
  },
  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
    cookiePrefix: "lms-gdsg",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/",
    },
    disableCSRFCheck: false,
    disableOriginCheck: false,
    database: {
      generateId: false,
    },
  },
  disabledPaths: ["/sign-up/email", "/get-access-token", "/account-info"],
  databaseHooks: {
    user: {
      create: {
        before: async () => false,
      },
    },
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: {
              status: true,
              lockedAt: true,
              deletedAt: true,
            },
          });

          return Boolean(
            user &&
            user.status === "ACTIVE" &&
            !user.lockedAt &&
            !user.deletedAt,
          );
        },
        after: async (session) => {
          await prisma.user.update({
            where: { id: session.userId },
            data: { lastLoginAt: new Date() },
          });
        },
      },
    },
    account: {
      create: {
        before: async (account) => ({
          data: encryptAccountTokens(account),
        }),
      },
      update: {
        before: async (account) => ({
          data: encryptAccountTokens(account),
        }),
      },
    },
  },
  onAPIError: {
    throw: false,
    onError: (error) => {
      logger.warn(
        {
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : String(error),
        },
        "Better Auth request failed",
      );
    },
  },
  experimental: {
    joins: true,
  },
  plugins: [nextCookies()],
});
