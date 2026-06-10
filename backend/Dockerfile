# ============================================================
# AetherMesh Engine — Backend API Server
# Express + tsx (no build step, runs TypeScript directly)
# ============================================================
FROM node:20-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install

COPY backend/ ./
COPY ai/ /ai/

EXPOSE 3001
CMD ["npx", "tsx", "src/server.ts"]
