# ── Stage 1: Install all dependencies ────────────────
FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# ── Stage 2: Build TypeScript ─────────────────────────
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Stage 3: Production dependencies only ────────────
FROM node:20-slim AS prod-deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev
RUN npx prisma generate

# ── Stage 4: Final runner image ───────────────────────
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install system packages as root BEFORE switching user
RUN apt-get update -y \
  && apt-get install -y openssl curl wget --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 ledgerlens

# Switch to non-root user
USER ledgerlens

# Copy built app and dependencies
COPY --from=builder   --chown=ledgerlens:nodejs /app/dist        ./dist
COPY --from=prod-deps --chown=ledgerlens:nodejs /app/node_modules ./node_modules
COPY --from=builder   --chown=ledgerlens:nodejs /app/package.json ./package.json
COPY --from=builder   --chown=ledgerlens:nodejs /app/prisma      ./prisma

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Single command runs server + worker (worker starts inside server.ts)
CMD ["node", "dist/server.js"]