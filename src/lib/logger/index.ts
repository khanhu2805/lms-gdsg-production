import pino from "pino";

import { env } from "@/config/env";

const redactedPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "headers.authorization",
  "headers.cookie",
  "accessToken",
  "refreshToken",
  "idToken",
  "password",
  "secret",
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: redactedPaths,
    censor: "[REDACTED]",
  },
  base: {
    service: "lms-gdsg",
    environment: env.NODE_ENV,
  },
});
