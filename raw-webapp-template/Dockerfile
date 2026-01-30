# Template Renderer Dockerfile - Next.js Standalone
# Clean single-server approach with built-in API proxy

# ===================================
# Stage 1: Dependencies  
# ===================================
FROM public.ecr.aws/docker/library/node:18-alpine AS deps
WORKDIR /app

# Copy workspace package files
COPY package*.json ./
COPY packages/template-sdk/package*.json ./packages/template-sdk/
COPY packages/template-invoice/package*.json ./packages/template-invoice/
COPY packages/template-workflow-approval/package*.json ./packages/template-workflow-approval/
COPY packages/template-questions-dark-theme/package*.json ./packages/template-questions-dark-theme/
COPY renderer/package*.json ./renderer/

# Install all dependencies
RUN npm ci --workspaces --include-workspace-root

# ===================================
# Stage 2: Builder
# ===================================
FROM public.ecr.aws/docker/library/node:18-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app ./

# Copy source code
COPY packages/ ./packages/
COPY renderer/ ./renderer/

# Build Next.js with standalone output
WORKDIR /app/renderer
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ===================================
# Stage 3: Production Runtime
# ===================================
FROM public.ecr.aws/docker/library/node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Create app directory and non-root user
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built Next.js standalone application
COPY --from=builder --chown=nextjs:nodejs /app/renderer/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/renderer/.next/static ./.next/static

# Copy lib directory with mock-nodes.json and other runtime files
COPY --from=builder --chown=nextjs:nodejs /app/renderer/lib ./renderer/lib

# Copy public directory (contains pdf.worker.mjs and other static assets)
COPY --from=builder --chown=nextjs:nodejs /app/renderer/public ./public

# Copy template packages (needed for dynamic imports)
COPY --from=builder --chown=nextjs:nodejs /app/packages ./packages

# Copy node_modules from builder (standalone doesn't include all dependencies)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV RENDERER_INTERNAL_URL=http://127.0.0.1:3000

# Health check for ECS
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Expose port 3000
EXPOSE 3000

# Start Next.js standalone server
CMD ["node", "server.js"]