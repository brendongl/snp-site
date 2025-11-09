# Use official Microsoft Playwright image (includes Chromium + all dependencies)
FROM mcr.microsoft.com/playwright:v1.48.0-noble

WORKDIR /app

# Install Playwright browsers (must be done before copying package.json)
RUN npx playwright@1.48.0 install chromium

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Expose port (Railway will set PORT env var, default to 3000)
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
