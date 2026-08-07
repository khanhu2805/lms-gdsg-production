import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
    BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32)
      .default("development_only_change_this_secret_123456"),
    BETTER_AUTH_TRUSTED_ORIGINS: z.string().default("http://localhost:3000"),
    DATABASE_URL: z
      .string()
      .min(1)
      .default(
        "postgresql://lms:lms_password@localhost:5432/lms_gdsg?schema=public",
      ),
    DIRECT_URL: z
      .string()
      .min(1)
      .default(
        "postgresql://lms:lms_password@localhost:5432/lms_gdsg?schema=public",
      ),
    DATABASE_POOL_MAX: z.coerce.number().int().min(2).max(100).default(20),
    DATABASE_POOL_IDLE_TIMEOUT_SECONDS: z.coerce
      .number()
      .int()
      .min(1)
      .max(300)
      .default(30),
    GOOGLE_CLIENT_ID: z.string().min(1).default("development-google-client-id"),
    GOOGLE_CLIENT_SECRET: z
      .string()
      .min(1)
      .default("development-google-client-secret"),
    OAUTH_TOKEN_ENCRYPTION_KEY: z
      .string()
      .regex(/^[a-fA-F0-9]{64}$/)
      .default(
        "0000000000000000000000000000000000000000000000000000000000000000",
      ),
    SEED_ADMIN_EMAIL: z.email().default("admin@example.com"),
    SEED_ADMIN_NAME: z.string().min(2).default("Quản trị viên"),
    SEED_DEMO: booleanFromString,
    UPLOAD_ROOT: z.string().min(1).default("/data/lms"),
    RECORDINGS_DIR: z.string().min(1).default("/data/lms/recordings"),
    DOCUMENTS_DIR: z.string().min(1).default("/data/lms/documents"),
    SUBMISSIONS_DIR: z.string().min(1).default("/data/lms/submissions"),
    IMAGES_DIR: z.string().min(1).default("/data/lms/images"),
    THUMBNAILS_DIR: z.string().min(1).default("/data/lms/thumbnails"),
    REPORTS_DIR: z.string().min(1).default("/data/lms/reports"),
    TEMP_DIR: z.string().min(1).default("/data/lms/temp"),
    BACKUPS_DIR: z.string().min(1).default("/data/lms/backups"),
    MAX_VIDEO_SIZE_MB: z.coerce.number().int().positive().default(8192),
    MAX_DOCUMENT_SIZE_MB: z.coerce.number().int().positive().default(100),
    MAX_SUBMISSION_SIZE_MB: z.coerce.number().int().positive().default(50),
    MAX_CONCURRENT_VIDEO_SESSIONS: z.coerce
      .number()
      .int()
      .positive()
      .default(2),
    VIDEO_COMPLETION_PERCENTAGE: z.coerce.number().min(1).max(100).default(90),
    VIDEO_PROGRESS_INTERVAL_SECONDS: z.coerce.number().int().min(5).default(20),
    MAX_CONCURRENT_VIDEO_JOBS: z.coerce
      .number()
      .int()
      .min(1)
      .max(16)
      .default(2),
    WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(500).default(3000),
    WORKER_ID: z.string().min(1).default("lms-worker-1"),
    ATTENDANCE_EARLY_MINUTES: z.coerce
      .number()
      .int()
      .min(0)
      .max(180)
      .default(15),
    ATTENDANCE_LATE_AFTER_MINUTES: z.coerce
      .number()
      .int()
      .min(0)
      .max(180)
      .default(10),
    FFMPEG_PATH: z.string().min(1).default("ffmpeg"),
    FFPROBE_PATH: z.string().min(1).default("ffprobe"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV !== "production") return;

    const unsafeValues: Array<[keyof typeof value, string]> = [
      ["BETTER_AUTH_SECRET", "Secret Better Auth chưa được thay đổi."],
      ["GOOGLE_CLIENT_ID", "Google Client ID chưa được cấu hình."],
      ["GOOGLE_CLIENT_SECRET", "Google Client Secret chưa được cấu hình."],
      ["OAUTH_TOKEN_ENCRYPTION_KEY", "Khóa mã hóa OAuth chưa được cấu hình."],
    ];

    for (const [field, message] of unsafeValues) {
      const raw = String(value[field]);
      if (
        raw.includes("development") ||
        raw.includes("replace_") ||
        /^0+$/.test(raw)
      ) {
        context.addIssue({
          code: "custom",
          path: [field],
          message,
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const fields = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Cấu hình môi trường không hợp lệ: ${fields}`);
}

export const env = {
  ...parsed.data,
  BETTER_AUTH_TRUSTED_ORIGINS: parsed.data.BETTER_AUTH_TRUSTED_ORIGINS.split(
    ",",
  )
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export type AppEnv = typeof env;
