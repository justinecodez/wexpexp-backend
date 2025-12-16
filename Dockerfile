# Build stage - compile TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production=false

# Copy source code
COPY . .

# Build TypeScript with increased memory
ENV NODE_OPTIONS="--max-old-space-size=1024"
RUN npm run build

# Production stage - run compiled JavaScript
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled JavaScript from builder
COPY --from=builder /app/dist ./dist

# Copy necessary runtime files
COPY .env* ./
RUN mkdir -p uploads logs

# Set environment
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Run the compiled JavaScript (NOT ts-node!)
CMD ["node", "dist/app.js"]
