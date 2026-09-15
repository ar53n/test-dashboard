# Клиент: сборка Vite → статика в nginx.

FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/
RUN npm ci --no-audit --no-fund

COPY . .
# Сборка падает, если бандл превысил бюджет 200 КБ gzip.
RUN npm run build && npm run size && npm run compress

FROM nginx:1.29-alpine
# Шаблон проходит через envsubst при старте контейнера (API_UPSTREAM задаёт compose).
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
