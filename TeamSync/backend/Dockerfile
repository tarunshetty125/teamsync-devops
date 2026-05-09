# ─────────────────────────────────────────────────────────────
# Backend Dockerfile
# Multi-stage build for TypeScript Node.js Express application
# ─────────────────────────────────────────────────────────────

# Stage 1: Build TypeScript
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files first (for better layer caching)
COPY package*.json ./

# Install all dependencies (including devDependencies for TypeScript compilation)
RUN npm ci

# Copy application source code
COPY . .

# Compile TypeScript to JavaScript
RUN npm run build

# Stage 2: Production image
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY --from=build /app/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy compiled JavaScript from build stage
COPY --from=build /app/dist ./dist

# Expose the application port
EXPOSE 8000

# Health check to verify the container is running
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/v1/auth/health || exit 1

# Run as non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001
USER nodeuser

# Start the application
CMD ["node", "dist/index.js"]
