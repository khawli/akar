# --- deps ---
FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- build ---
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# --- runtime ---
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup -S app && adduser -S app -G app

# Copy minimal runtime
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules

# Prisma files if you use them at runtime (optional but safe)
COPY --from=build /app/prisma ./prisma

# Documents storage mount point
RUN mkdir -p /data/docs && chown -R app:app /data
USER app

EXPOSE 3000

# Start: migrate then run
CMD sh -c "pnpm prisma migrate deploy && pnpm start"
