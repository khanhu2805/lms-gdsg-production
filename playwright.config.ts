import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const e2eBaseUrl =
  process.env.E2E_BASE_URL?.trim() || "http://127.0.0.1:3000";
const e2eDatabaseUrl = process.env.E2E_DATABASE_URL?.trim();
if (e2eDatabaseUrl) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Không được chạy E2E role tests với NODE_ENV=production.");
  }
  process.env.DATABASE_URL = e2eDatabaseUrl;
  process.env.BETTER_AUTH_URL = e2eBaseUrl;
  process.env.BETTER_AUTH_TRUSTED_ORIGINS = e2eBaseUrl;
  process.env.NEXT_PUBLIC_APP_URL = e2eBaseUrl;
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --hostname 127.0.0.1",
        url: "http://127.0.0.1:3000/healthz",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: e2eDatabaseUrl
          ? {
              DATABASE_URL: e2eDatabaseUrl,
              BETTER_AUTH_URL: e2eBaseUrl,
              BETTER_AUTH_TRUSTED_ORIGINS: e2eBaseUrl,
              NEXT_PUBLIC_APP_URL: e2eBaseUrl,
            }
          : undefined,
      },
});
