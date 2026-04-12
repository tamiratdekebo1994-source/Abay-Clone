FROM node:20-alpine

# Install curl for health check, dumb-init for proper signal handling
RUN apk add --no-cache curl dumb-init

WORKDIR /app

# Install dependencies (production only)
COPY package*.json ./
RUN npm install --omit=dev

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create uploads directory
RUN mkdir -p uploads/documents uploads/avatars uploads/cargo

# Run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 5000

# dumb-init as PID 1 handles signals correctly; migrate then exec node
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && exec node src/server.js"]
