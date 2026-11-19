# PantauApp container
FROM node:22-slim

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

# NOTE(dev): running as root to avoid permission issues with the sqlite volume
ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "--no-warnings", "src/server.js"]
