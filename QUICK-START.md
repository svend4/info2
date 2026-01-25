# T-Hub Quick Start Guide

Быстрый старт для разработчиков, желающих запустить T-Hub локально.

---

## Предварительные требования

- **Node.js** 18+ ([скачать](https://nodejs.org/))
- **Docker** и **Docker Compose** ([скачать](https://www.docker.com/))
- **Git** ([скачать](https://git-scm.com/))

---

## Вариант 1: Docker Compose (Рекомендуется)

Самый простой способ запустить весь стек T-Hub.

### 1. Клонировать репозиторий

```bash
git clone https://github.com/svend4/info2.git
cd info2
```

### 2. Запустить все сервисы

```bash
docker-compose up -d
```

Это запустит:
- API Server (порт 3000)
- PostgreSQL (порт 5432)
- Redis (порт 6379)
- Elasticsearch (порт 9200)
- MinIO (порт 9000)
- Prometheus (порт 9090)
- Grafana (порт 3001)
- Nginx (порт 80)

### 3. Проверить статус

```bash
docker-compose ps
```

### 4. Открыть в браузере

- **API**: http://localhost:3000/health
- **API Docs**: http://localhost:3000/api-docs
- **MinIO Console**: http://localhost:9001
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)

### 5. Использовать CLI

```bash
# Установить CLI глобально
cd prototype
npm install -g .

# Или использовать локально
npm link

# Проверить установку
thub --help

# Поиск компонентов
thub search jwt

# Информация о компоненте
thub info jwt-generator
```

### 6. Остановить сервисы

```bash
docker-compose down

# Или с очисткой volumes
docker-compose down -v
```

---

## Вариант 2: Локальный запуск (Для разработки)

### 1. Установить зависимости

```bash
cd prototype
npm install
```

### 2. Настроить environment variables

Создайте файл `.env`:

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://thub:thub_password@localhost:5432/thub
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
LOG_LEVEL=debug
```

### 3. Запустить базы данных (через Docker)

```bash
# PostgreSQL
docker run -d \
  --name thub-postgres \
  -e POSTGRES_DB=thub \
  -e POSTGRES_USER=thub \
  -e POSTGRES_PASSWORD=thub_password \
  -p 5432:5432 \
  postgres:15-alpine

# Redis
docker run -d \
  --name thub-redis \
  -p 6379:6379 \
  redis:7-alpine
```

### 4. Запустить API server

```bash
npm start

# Или в dev mode с hot reload
npm run dev
```

### 5. Запустить тесты

```bash
# Unit tests
npm test

# С coverage
npm run test:coverage

# Integration tests
npm run test:integration
```

---

## Вариант 3: Kubernetes (Production)

### 1. Установить kubectl и minikube

Для локального тестирования:

```bash
# Установить minikube
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

# Запустить minikube
minikube start
```

### 2. Применить манифесты

```bash
kubectl apply -f k8s/base/
```

### 3. Проверить поды

```bash
kubectl get pods
kubectl get services
kubectl get ingress
```

### 4. Получить доступ к сервису

```bash
# Port forward
kubectl port-forward service/thub-api 3000:80

# Или через minikube
minikube service thub-api
```

---

## Быстрые команды

### CLI

```bash
# Инициализация проекта
thub init

# Публикация компонента
thub publish ./my-component.js --name my-component --category utils

# Поиск
thub search "jwt authentication"

# Установка
thub install jwt-generator@2.1.3

# Информация
thub info jwt-generator

# Сборка приложения
thub build

# Поиск дубликатов
thub deduplicate

# Статистика
thub stats
```

### API Endpoints

```bash
# Health check
curl http://localhost:3000/health

# List components
curl http://localhost:3000/api/v1/components

# Get component
curl http://localhost:3000/api/v1/components/{id}

# Search
curl http://localhost:3000/api/v1/search?q=jwt

# Stats
curl http://localhost:3000/api/v1/stats

# Trending
curl http://localhost:3000/api/v1/trending?period=week
```

### Docker Commands

```bash
# Просмотр логов
docker-compose logs -f api

# Перезапустить сервис
docker-compose restart api

# Выполнить команду в контейнере
docker-compose exec api sh

# Очистить volumes
docker-compose down -v
```

---

## Примеры использования

### Пример 1: Использовать компонент в проекте

```javascript
// Установить компонент
// thub install jwt-generator

const { generateToken, verifyToken } = require('jwt-generator');

// Генерация токена
const token = generateToken(
  { userId: 123, role: 'admin' },
  'secret-key',
  { expiresIn: 3600 }
);

// Проверка токена
const payload = verifyToken(token, 'secret-key');
console.log(payload); // { userId: 123, role: 'admin', ... }
```

### Пример 2: Создать приложение из компонентов

Создайте файл `myapp.thub.yaml`:

```yaml
apiVersion: thub.io/v1
kind: Application

metadata:
  name: my-api
  version: 1.0.0

components:
  backend:
    - jwt-generator@2.1.3
    - validator@1.5.0
    - query-builder@3.2.1
    - rate-limiter@2.0.5

configuration:
  port: 3000
  database:
    type: postgresql
    host: localhost
    port: 5432
```

Соберите приложение:

```bash
thub build
```

### Пример 3: Проверить дубликаты в проекте

```bash
cd your-project
thub deduplicate

# Вывод:
# Найдено 3 дубликата:
# 1. Схожесть: 95%
#    Оригинал: utils/validator.js
#    Дубликат: helpers/validation.js
```

---

## Troubleshooting

### Проблема: "Port already in use"

```bash
# Найти процесс на порту 3000
lsof -i :3000

# Убить процесс
kill -9 <PID>

# Или изменить порт в .env
PORT=3001
```

### Проблема: "Database connection error"

```bash
# Проверить что PostgreSQL запущен
docker ps | grep postgres

# Проверить логи
docker logs thub-postgres

# Пересоздать контейнер
docker-compose down
docker-compose up -d postgres
```

### Проблема: "npm install fails"

```bash
# Очистить кэш npm
npm cache clean --force

# Удалить node_modules
rm -rf node_modules package-lock.json

# Переустановить
npm install
```

---

## Полезные ссылки

- **Documentation**: См. файлы `01-DEFINITIONS.md` - `06-ROADMAP.md`
- **API Docs**: http://localhost:3000/api-docs (Swagger UI)
- **Contributing**: См. `CONTRIBUTING.md`
- **Code of Conduct**: См. `CODE_OF_CONDUCT.md`

---

## Следующие шаги

1. Изучите [документацию](README.md)
2. Попробуйте [примеры компонентов](prototype/examples/components/)
3. Создайте свой компонент
4. Прочитайте [Contributing Guide](CONTRIBUTING.md)
5. Присоединяйтесь к сообществу

---

**Happy Coding! 🚀**
