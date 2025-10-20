# Multi-stage build for optimized production image
FROM node:20.18.1-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
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

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Create data directory for cache with proper permissions
RUN mkdir -p data data/images logs
RUN chown -R nextjs:nodejs data logs

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
CMD ["node", "server.js"]