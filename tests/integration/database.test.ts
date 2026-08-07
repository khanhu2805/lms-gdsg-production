import { PrismaPg } from "@prisma/adapter-pg";
import { describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";

const testUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testUrl)("PostgreSQL integration", () => {
  it("có toàn bộ migration và các ràng buộc nghiệp vụ", async () => {
    const client = new PrismaClient({
      adapter: new PrismaPg({ connectionString: testUrl! }),
    });
    try {
      const migrations = await client.$queryRaw<
        Array<{ migration_name: string; finished_at: Date | null }>
      >`SELECT "migration_name", "finished_at" FROM "_prisma_migrations" ORDER BY "finished_at"`;
      expect(migrations.length).toBeGreaterThan(0);
      expect(migrations.every((migration) => migration.finished_at)).toBe(true);

      const checks = await client.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS "count"
        FROM pg_constraint
        WHERE contype = 'c'
          AND connamespace = 'public'::regnamespace
      `;
      expect(Number(checks[0]?.count ?? 0)).toBeGreaterThanOrEqual(8);
    } finally {
      await client.$disconnect();
    }
  });
});
