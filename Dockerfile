# Multi-stage Docker build for Taskly
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm ci

# Copy source and compile frontend
COPY . .
RUN npm run build

# Runner stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Backend only relies on native Node.js standard libraries
COPY package*.json ./
COPY backend/ ./backend/
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 3001

CMD ["node", "backend/server.mjs"]
