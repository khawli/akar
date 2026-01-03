# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:24-bookworm-slim
ARG PNPM_VERSION=10.27.0

# --- deps ---
FROM ${NODE_IMAGE} AS deps
WORKDIR /app

# Playwright browsers location (shared across stages)
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates openssl dumb-init \
  && rm -rf /var/lib/apt/lists/*

# Reproducible pnpm
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- build ---
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma: generate client at build time (prevents runtime downloads/permission issues)
# Dummy DATABASE_URL just to satisfy config during generate (no real DB needed here)
RUN DATABASE_URL="postgresql://akar:akar@localhost:5432/akar?schema=public" pnpm prisma generate

# Playwright: download chromium at build time (no runtime download)
RUN pnpm exec playwright install chromium

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# --- runtime ---
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Minimal OS deps + explicit chromium libs (stable in prod)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates openssl dumb-init \
    fonts-liberation libnss3 libatk-bridge2.0-0 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxrandr2 libgbm1 libasound2 \
  && rm -rf /var/lib/apt/lists/*

# Non-root user (best practice)
RUN groupadd -r app && useradd -r -g app app

# Ensure HOME + writable cache dirs for non-root runtime
ENV HOME=/home/app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV COREPACK_HOME=/home/app/.cache/node/corepack
RUN mkdir -p /home/app/.cache/node/corepack /home/app/.local/share \
  && chown -R app:app /home/app

# Copy runtime artifacts with correct ownership
COPY --from=build --chown=app:app /app/.next ./.next
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/prisma.config.ts ./prisma.config.ts

# Copy Playwright browsers
COPY --from=build --chown=app:app /ms-playwright /ms-playwright

# Documents storage mount point
RUN mkdir -p /data/docs && chown -R app:app /data

USER app
EXPOSE 3000

# Proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start: migrate then run (no pnpm/corepack needed at runtime)
CMD sh -c "./node_modules/.bin/prisma migrate deploy && node ./node_modules/next/dist/bin/next start -p 3000"
