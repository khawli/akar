# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=node:24-bookworm-slim
ARG PNPM_VERSION=10.27.0

# ---------- base ----------
FROM ${NODE_IMAGE} AS base
WORKDIR /app

ENV CI=1
ENV NEXT_TELEMETRY_DISABLED=1
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates openssl dumb-init \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable \
 && corepack prepare pnpm@${PNPM_VERSION} --activate

# ---------- deps ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---------- dev (USED BY docker-compose.dev.yml) ----------
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-lc", "pnpm dev -H 0.0.0.0 -p 3000"]

# ---------- build ----------
FROM base AS build
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
RUN pnpm build

# ---------- runtime (prod) ----------
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000

RUN groupadd -r app && useradd -r -g app -m -d /home/app app
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma

RUN mkdir -p /data/docs && chown -R app:app /data
USER app

EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-lc", "pnpm prisma migrate deploy && pnpm exec next start -p 3000"]
