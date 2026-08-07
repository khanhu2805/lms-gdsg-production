import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "@/config/env";
import { PrismaClient } from "@/generated/prisma/client";

const globalForDatabase = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    idleTimeoutMillis: env.DATABASE_POOL_IDLE_TIMEOUT_SECONDS * 1000,
  });

  return new PrismaClient({
    adapter,
    log:
      env.NODE_ENV === "development"
        ? [
            { emit: "stdout", level: "warn" },
            { emit: "stdout", level: "error" },
          ]
        : [{ emit: "stdout", level: "error" }],
  });
}

export const prisma = globalForDatabase.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForDatabase.prisma = prisma;
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}
