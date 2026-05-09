# ─────────────────────────────────────────────────────────────
# Frontend (Client) Dockerfile
# Multi-stage build: Node (build) → Nginx (serve)
# ─────────────────────────────────────────────────────────────

# Stage 1: Build the React app
FROM node:18-alpine AS build

WORKDIR /app

# Build argument for API base URL (baked into the JS bundle at build time)
ARG VITE_API_BASE_URL=http://teamsyncin.duckdns.org/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Copy package files for dependency caching
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy custom nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
