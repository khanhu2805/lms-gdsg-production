# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM deps AS builder
COPY . .
ARG NEXT_PUBLIC_APP_URL=https://lms.giaoducsaigon.edu.vn
ENV DATABASE_URL=postgresql://lms:build-only@localhost:5432/lms_gdsg?schema=public \
    DIRECT_URL=postgresql://lms:build-only@localhost:5432/lms_gdsg?schema=public \
    BETTER_AUTH_SECRET=build-only-secret-with-more-than-32-characters \
    GOOGLE_CLIENT_ID=build-only-client-id \
    GOOGLE_CLIENT_SECRET=build-only-client-secret \
    OAUTH_TOKEN_ENCRYPTION_KEY=1111111111111111111111111111111111111111111111111111111111111111
RUN npm run db:generate
RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs \
    && mkdir -p /data/lms/recordings /data/lms/documents /data/lms/submissions /data/lms/images /data/lms/thumbnails /data/lms/reports /data/lms/temp /data/lms/backups \
    && chown -R nextjs:nodejs /data/lms
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

FROM deps AS worker
RUN apt-get update \
    && apt-get install -y --no-install-recommends \ 
    ffmpeg \
    ca-certificates \
    libreoffice-core \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    && rm -rf /var/lib/apt/lists/*
COPY . .
RUN DATABASE_URL=postgresql://lms:build-only@localhost:5432/lms_gdsg?schema=public \
    DIRECT_URL=postgresql://lms:build-only@localhost:5432/lms_gdsg?schema=public \
    npm run db:generate
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs worker \
    && mkdir -p /data/lms/recordings /data/lms/documents /data/lms/submissions /data/lms/images /data/lms/thumbnails /data/lms/reports /data/lms/temp /data/lms/backups \
    && chown -R worker:nodejs /data/lms /app
USER worker
CMD ["npm", "run", "worker"]

FROM deps AS migrate
COPY . .
RUN DATABASE_URL=postgresql://lms:build-only@localhost:5432/lms_gdsg?schema=public \
    DIRECT_URL=postgresql://lms:build-only@localhost:5432/lms_gdsg?schema=public \
    npm run db:generate
CMD ["sh", "-c", "npm run db:deploy && npm run db:seed"]
