# Multi-stage build for optimized production image
FROM node:20-slim AS base

# Install dependencies only when needed
FROM base AS deps
# libc6-compat not needed for Debian-based slim image
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
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

# Set dummy environment variables for build (runtime will use actual values)
# These prevent build-time errors when Next.js tries to validate env vars
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
    FACEBOOK_APP_ID=dummy_app_id \
    FACEBOOK_APP_SECRET=dummy_secret \
    FACEBOOK_PAGE_ID=dummy_page_id \
    FACEBOOK_ACCESS_TOKEN=dummy_token \
    N8N_WEBHOOK_URL=https://dummy.n8n.com/webhook/dummy \
    N8N_API_KEY=dummy_api_key \
    GOOGLE_MAPS_API_KEY=dummy_maps_key

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install gosu for user switching in entrypoint
RUN apt-get update && apt-get install -y gosu && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Don't create data directories here - they'll be created by entrypoint
# This allows the entrypoint to properly handle mounted volumes

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Don't switch to nextjs user here - entrypoint will do it after fixing permissions
# USER nextjs is removed - entrypoint handles this

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Use entrypoint script instead of direct CMD
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]