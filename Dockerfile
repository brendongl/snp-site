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

RUN npm run build

# Production image with Playwright support
# Use Microsoft's official Playwright image which includes Chromium + all dependencies
FROM mcr.microsoft.com/playwright:v1.48.0-noble AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Playwright image already has pwuser (UID 1000), use it for Next.js
# This avoids permission issues and follows security best practices
USER root

# Install gosu for proper user switching (if needed by entrypoint)
RUN apt-get update && apt-get install -y gosu && \
    rm -rf /var/lib/apt/lists/*

# Install Playwright browsers (Chromium) with system dependencies
# This installs to /ms-playwright which is accessible by all users
RUN npx playwright@1.48.0 install --with-deps chromium

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# Copy the entire standalone directory which includes the correct .next structure
COPY --from=builder --chown=pwuser:pwuser /app/.next/standalone ./
COPY --from=builder --chown=pwuser:pwuser /app/.next/static ./.next/static

# Create data directory (will be mounted at runtime from persistent volume)
RUN mkdir -p data && chown -R pwuser:pwuser data

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Use entrypoint script
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
