# ============================================================
# AetherMesh Engine — Frontend Dev Server
# Node 20 Alpine + Vite HMR + Wasm COOP/COEP headers
# ============================================================
FROM node:20-alpine

WORKDIR /app

# Install deps first for better layer caching
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install

# Copy source
COPY frontend/ ./

EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
