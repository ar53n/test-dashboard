# Сервер запускается без сборки: Node 24 исполняет TypeScript напрямую (type stripping).
# Контекст сборки — корень репозитория: нужны lock-файл workspace и общий контракт shared/.
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY server/package.json server/
RUN npm ci --workspace server --omit=dev --no-audit --no-fund && npm cache clean --force

COPY shared shared
COPY server/src server/src

USER node
WORKDIR /app/server
EXPOSE 3001
CMD ["node", "src/index.ts"]
