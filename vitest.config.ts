import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: [
        "src/lib/authorization/permissions.ts",
        "src/modules/classes/capacity.ts",
        "src/modules/contents/content.permissions.ts",
        "src/modules/attendance/attendance-policy.ts",
        "src/modules/quizzes/quiz-timing.ts",
        "src/lib/security/token-encryption.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 75,
        branches: 70,
        statements: 80,
      },
    },
  },
});
