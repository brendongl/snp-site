# Multi-stage build for optimized production image
FROM node:20-slim AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
ENV NEXT_TELEMETRY_DISABLED=1

# Set dummy environment variables for build (runtime will use actual values)
ENV AIRTABLE_API_KEY=dummy_key_for_build \
    AIRTABLE_GAMES_BASE_ID=dummy_base_id \
    AIRTABLE_GAMES_TABLE_ID=dummy_table_id \
    AIRTABLE_GAMES_VIEW_ID=dummy_view_id \
    AIRTABLE_CUSTOMER_BASE_ID=dummy_base_id \
    AIRTABLE_CUSTOMER_TABLE_ID=dummy_table_id \
    AIRTABLE_EVENTS_TABLE_ID=dummy_table_id \
    NEXTAUTH_URL=http://localhost:3000 \
    NEXTAUTH_SECRET=dummy_secret_for_build_only \
    DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/dummy \
    DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy

# Build arg to optionally enable iPOS/Playwright support
ARG ENABLE_IPOS=false

# Only install Playwright browsers if explicitly enabled
RUN if [ "$ENABLE_IPOS" = "true" ]; then \
      npm install playwright && \
      npx playwright install chromium; \
    fi

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Build arg for optional iPOS support
ARG ENABLE_IPOS=false

# Install gosu and optionally Playwright dependencies
RUN apt-get update && apt-get install -y gosu && \
    if [ "$ENABLE_IPOS" = "true" ]; then \
      apt-get install -y \
      libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
      libcups2 libdrm2 libdbus-1-3 libatspi2.0-0 \
      libx11-6 libxcomposite1 libxdamage1 libxext6 \
      libxfixes3 libxrandr2 libgbm1 libxcb1 \
      libxkbcommon0 libpango-1.0-0 libcairo2 libasound2; \
    fi && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/public ./public

# Only copy Playwright if enabled
RUN if [ "$ENABLE_IPOS" = "true" ]; then \
      mkdir -p /root/.cache/ms-playwright; \
    fi
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/server.js ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create necessary directories (data will be mounted at runtime)
RUN mkdir -p .next data && \
    chown -R nextjs:nodejs .next data


# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Use entrypoint script
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
