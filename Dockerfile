# T-Hub Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Build
FROM node:18-alpine AS builder

# Установка зависимостей для сборки
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Копируем package files
COPY prototype/package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем исходный код
COPY prototype/ ./

# Stage 2: Production
FROM node:18-alpine

# Создаём non-root пользователя
RUN addgroup -g 1001 -S thub && \
    adduser -S thub -u 1001

WORKDIR /app

# Копируем зависимости и код из builder
COPY --from=builder --chown=thub:thub /app ./

# Переключаемся на non-root пользователя
USER thub

# Exposing порт
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); });"

# Запуск сервера
CMD ["node", "api/server.js"]
