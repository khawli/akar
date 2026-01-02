# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:24-bookworm-slim
ARG PNPM_VERSION=10.27.0

# --- deps ---
FROM ${NODE_IMAGE} AS deps
WORKDIR /app

# Where Playwright browsers will be stored (copied to runtime)
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates openssl dumb-init \
  && rm -rf /var/lib/apt/lists/*

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

# Prisma generate at build time (needs dotenv in deps)
RUN DATABASE_URL="postgresql://akar:akar@localhost:5432/akar?schema=public" pnpm prisma generate

# Download chromium at build time (no runtime download)
RUN pnpm exec playwright install chromium

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# --- runtime ---
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates openssl dumb-init \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

RUN groupadd -r app && useradd -r -g app app

COPY --from=build --chown=app:app /app/.next ./.next
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/package.json ./package.json
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/prisma ./prisma

COPY --from=build --chown=app:app /ms-playwright /ms-playwright

# Install OS deps for chromium (no browser download)
RUN pnpm exec playwright install-deps chromium

RUN mkdir -p /data/docs && chown -R app:app /data

USER app
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD sh -c "pnpm prisma migrate deploy && pnpm start"
