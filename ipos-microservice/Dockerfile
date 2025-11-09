# Use official Microsoft Playwright image (includes Chromium + all dependencies)
FROM mcr.microsoft.com/playwright:v1.48.0-noble

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Expose port (Render will set PORT env var, default to 3001)
EXPOSE 3001

# Start the server
CMD ["npm", "start"]
