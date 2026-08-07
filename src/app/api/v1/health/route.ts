import { prisma } from "@/lib/database/client";
import { apiError, apiSuccess } from "@/lib/errors/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const startedAt = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    return apiSuccess({
      service: "lms-gdsg",
      status: "healthy",
      database: "available",
      databaseLatencyMs: Math.round(performance.now() - startedAt),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}
