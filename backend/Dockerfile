# ─────────────────────────────────────────────────────────────
# Backend Dockerfile
# Multi-stage build for Node.js Express application
# ─────────────────────────────────────────────────────────────

# Stage 1: Production image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for better layer caching)
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application source code
COPY . .

# Expose the application port
EXPOSE 5006

# Health check to verify the container is running
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5006/api/health || exit 1

# Run as non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001
USER nodeuser

# Start the application
CMD ["node", "src/index.js"]
