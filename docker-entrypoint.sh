#!/bin/sh
set -e

echo "🔧 Fixing volume permissions..."

# Create directories if they don't exist and fix ownership
mkdir -p /app/data/images /app/logs
chown -R nextjs:nodejs /app/data /app/logs

echo "✅ Permissions fixed, starting application as nextjs user..."

# Switch to nextjs user and start the application
exec gosu nextjs node server.js
