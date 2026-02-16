# ============================================
# BeeCastly API Dockerfile
# ============================================

FROM node:20-alpine AS base

# Install dependencies
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# ============================================
# Builder stage
# ============================================
FROM base AS builder
WORKDIR /app
COPY . .
RUN npm run build

# ============================================
# Production stage
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 beecastly

# Copy built application
COPY --from=builder --chown=beecastly:nodejs /app/dist ./dist
COPY --from=builder --chown=beecastly:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=beecastly:nodejs /app/package.json ./package.json

# Switch to non-root user
USER beecastly

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start the application
CMD ["node", "dist/server.js"]
