FROM node:20-bookworm-slim

WORKDIR /app

# Install dependencies (include dev for build)
COPY package*.json ./
RUN npm ci

# Prisma client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Prune dev deps for runtime
RUN npm prune --production

EXPOSE 4000
CMD ["node", "dist/server.js"]
