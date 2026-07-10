FROM oven/bun:1.3-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.3-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM oven/bun:1.3-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3003
ENV HOSTNAME=0.0.0.0
RUN addgroup -S nextjs -g 1001 && adduser -S nextjs -u 1001 -G nextjs
RUN mkdir -p /app/data && chown nextjs:nextjs /app/data
COPY --from=build --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /app/.next/static ./.next/static
# server.js only traces what the Next.js app itself imports; the migrator
# submodule (only used by scripts/migrate.ts, run once at container start,
# never by the app) isn't reachable from that trace, so copy drizzle-orm in
# full rather than relying on it being picked up automatically.
COPY --from=build --chown=nextjs:nextjs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=build --chown=nextjs:nextjs /app/drizzle ./drizzle
COPY --from=build --chown=nextjs:nextjs /app/scripts/migrate.ts ./scripts/migrate.ts
USER nextjs
EXPOSE 3003
CMD ["sh", "-c", "bun run scripts/migrate.ts && bun server.js"]
