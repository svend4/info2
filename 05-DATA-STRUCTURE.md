# Структура данных и схема базы данных T-Hub

## 1. Схема PostgreSQL базы данных

### 1.1. Таблица: components (Компоненты)

```sql
CREATE TABLE components (
    -- Идентификация
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_hash VARCHAR(64) UNIQUE NOT NULL,  -- SHA-256 hash
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,  -- SemVer: MAJOR.MINOR.PATCH

    -- Метаданные
    description TEXT,
    author_id UUID REFERENCES users(id),
    license VARCHAR(50),  -- MIT, Apache-2.0, GPL-3.0, etc.

    -- Таксономия
    category VARCHAR(100) NOT NULL,  -- authentication, api, data, etc.
    subcategory VARCHAR(100),
    language VARCHAR(50) NOT NULL,  -- javascript, python, go, rust
    framework VARCHAR(100),  -- react, express, django, etc.
    tier VARCHAR(20),  -- frontend, backend, fullstack, infrastructure

    -- Качество
    test_coverage DECIMAL(5,2),  -- Percentage: 0.00 to 100.00
    security_score INTEGER,  -- 0-100
    performance_score INTEGER,  -- 0-100
    maintainability_grade VARCHAR(2),  -- A, B, C, D, E, F
    complexity_score INTEGER,
    lines_of_code INTEGER,

    -- Статистика
    downloads_count INTEGER DEFAULT 0,
    stars_count INTEGER DEFAULT 0,
    forks_count INTEGER DEFAULT 0,
    dependents_count INTEGER DEFAULT 0,  -- Сколько компонентов зависит от этого

    -- Хранение
    storage_size BIGINT,  -- Bytes
    storage_location TEXT,  -- S3 URL

    -- Статусы
    status VARCHAR(20) DEFAULT 'pending',  -- pending, approved, rejected, deprecated
    verified BOOLEAN DEFAULT FALSE,
    security_audited BOOLEAN DEFAULT FALSE,

    -- Временные метки
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_scanned_at TIMESTAMP,
    deprecated_at TIMESTAMP,

    -- Индексы
    CONSTRAINT unique_name_version UNIQUE (name, version)
);

-- Индексы для быстрого поиска
CREATE INDEX idx_components_content_hash ON components(content_hash);
CREATE INDEX idx_components_name ON components(name);
CREATE INDEX idx_components_category ON components(category);
CREATE INDEX idx_components_language ON components(language);
CREATE INDEX idx_components_author ON components(author_id);
CREATE INDEX idx_components_status ON components(status);
CREATE INDEX idx_components_created ON components(created_at DESC);
CREATE INDEX idx_components_downloads ON components(downloads_count DESC);
CREATE INDEX idx_components_stars ON components(stars_count DESC);

-- Полнотекстовый поиск
CREATE INDEX idx_components_search ON components
    USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));
```

---

### 1.2. Таблица: component_tags (Теги компонентов)

```sql
CREATE TABLE component_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_component_tag UNIQUE (component_id, tag)
);

CREATE INDEX idx_component_tags_tag ON component_tags(tag);
CREATE INDEX idx_component_tags_component ON component_tags(component_id);
```

---

### 1.3. Таблица: dependencies (Зависимости)

```sql
CREATE TABLE dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    dependency_id UUID REFERENCES components(id) ON DELETE CASCADE,
    dependency_type VARCHAR(20) NOT NULL,  -- required, optional, peer, dev
    version_constraint VARCHAR(100),  -- ^1.0.0, ~2.3.4, >=3.0.0
    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_dependency UNIQUE (component_id, dependency_id)
);

CREATE INDEX idx_dependencies_component ON dependencies(component_id);
CREATE INDEX idx_dependencies_dependency ON dependencies(dependency_id);

-- Предотвращение самозависимости
ALTER TABLE dependencies
    ADD CONSTRAINT check_no_self_dependency
    CHECK (component_id != dependency_id);
```

---

### 1.4. Таблица: component_exports (Экспорты API)

```sql
CREATE TABLE component_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    export_name VARCHAR(255) NOT NULL,
    export_type VARCHAR(50),  -- function, class, constant, type
    signature TEXT,  -- Function signature or type definition
    description TEXT,
    parameters JSONB,  -- Structured parameter information
    return_type VARCHAR(100),
    is_async BOOLEAN DEFAULT FALSE,
    deprecated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_component_exports_component ON component_exports(component_id);
CREATE INDEX idx_component_exports_name ON component_exports(export_name);
```

---

### 1.5. Таблица: quality_metrics (Метрики качества)

```sql
CREATE TABLE quality_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,

    -- Тесты
    tests_total INTEGER,
    tests_passed INTEGER,
    tests_failed INTEGER,
    test_coverage DECIMAL(5,2),

    -- Безопасность
    vulnerabilities_critical INTEGER DEFAULT 0,
    vulnerabilities_high INTEGER DEFAULT 0,
    vulnerabilities_medium INTEGER DEFAULT 0,
    vulnerabilities_low INTEGER DEFAULT 0,
    last_security_scan TIMESTAMP,

    -- Производительность
    benchmark_ops_per_sec INTEGER,
    memory_usage_mb DECIMAL(10,2),
    startup_time_ms INTEGER,

    -- Качество кода
    code_smells INTEGER,
    technical_debt_minutes INTEGER,
    duplicated_lines_percent DECIMAL(5,2),

    -- Метаданные
    measured_at TIMESTAMP DEFAULT NOW(),
    tool_name VARCHAR(100),  -- SonarQube, Snyk, etc.
    tool_version VARCHAR(50)
);

CREATE INDEX idx_quality_metrics_component ON quality_metrics(component_id);
CREATE INDEX idx_quality_metrics_measured ON quality_metrics(measured_at DESC);
```

---

### 1.6. Таблица: users (Пользователи)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    bio TEXT,

    -- OAuth
    github_id VARCHAR(50),
    google_id VARCHAR(50),

    -- Права
    role VARCHAR(20) DEFAULT 'user',  -- user, moderator, admin
    verified BOOLEAN DEFAULT FALSE,

    -- Статистика
    components_count INTEGER DEFAULT 0,
    total_downloads INTEGER DEFAULT 0,
    followers_count INTEGER DEFAULT 0,

    -- Временные метки
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_github ON users(github_id);
```

---

### 1.7. Таблица: applications (Приложения)

```sql
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES users(id),

    -- Метаданные
    repository_url TEXT,
    homepage_url TEXT,
    version VARCHAR(50),

    -- Статистика
    components_count INTEGER DEFAULT 0,
    total_size BIGINT,  -- Bytes

    -- Статус
    status VARCHAR(20) DEFAULT 'active',  -- active, archived, deprecated

    -- Временные метки
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_applications_owner ON applications(owner_id);
CREATE INDEX idx_applications_name ON applications(name);
```

---

### 1.8. Таблица: application_components (Компоненты приложения)

```sql
CREATE TABLE application_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_app_component UNIQUE (application_id, component_id)
);

CREATE INDEX idx_app_components_application ON application_components(application_id);
CREATE INDEX idx_app_components_component ON application_components(component_id);
```

---

### 1.9. Таблица: duplicates (Дубликаты)

```sql
CREATE TABLE duplicates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_a_id UUID REFERENCES components(id) ON DELETE CASCADE,
    component_b_id UUID REFERENCES components(id) ON DELETE CASCADE,
    similarity_score DECIMAL(5,2),  -- 0.00 to 100.00
    match_type VARCHAR(20),  -- exact, normalized, semantic
    detected_at TIMESTAMP DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE,
    resolution VARCHAR(20),  -- merged, kept_both, marked_duplicate

    CONSTRAINT check_different_components CHECK (component_a_id != component_b_id),
    CONSTRAINT unique_duplicate_pair UNIQUE (component_a_id, component_b_id)
);

CREATE INDEX idx_duplicates_component_a ON duplicates(component_a_id);
CREATE INDEX idx_duplicates_component_b ON duplicates(component_b_id);
CREATE INDEX idx_duplicates_similarity ON duplicates(similarity_score DESC);
CREATE INDEX idx_duplicates_unresolved ON duplicates(resolved) WHERE resolved = FALSE;
```

---

### 1.10. Таблица: download_stats (Статистика скачиваний)

```sql
CREATE TABLE download_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    application_id UUID REFERENCES applications(id) ON DELETE SET NULL,

    -- Контекст
    ip_address INET,
    user_agent TEXT,
    country_code VARCHAR(2),

    -- Временная метка
    downloaded_at TIMESTAMP DEFAULT NOW()
);

-- Партиционирование по месяцам (для больших данных)
CREATE INDEX idx_download_stats_component ON download_stats(component_id);
CREATE INDEX idx_download_stats_downloaded ON download_stats(downloaded_at DESC);
CREATE INDEX idx_download_stats_user ON download_stats(user_id);
```

---

### 1.11. Таблица: reviews (Отзывы)

```sql
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID REFERENCES components(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    content TEXT,

    -- Полезность
    helpful_count INTEGER DEFAULT 0,
    unhelpful_count INTEGER DEFAULT 0,

    -- Временные метки
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_user_review UNIQUE (component_id, user_id)
);

CREATE INDEX idx_reviews_component ON reviews(component_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
```

---

## 2. JSON Schema для компонента

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "T-Hub Component",
  "type": "object",
  "required": ["id", "name", "version", "category", "language", "code"],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid"
    },
    "content_hash": {
      "type": "string",
      "pattern": "^sha256:[a-f0-9]{64}$"
    },
    "metadata": {
      "type": "object",
      "required": ["name", "version"],
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 255,
          "pattern": "^[a-z0-9-]+$"
        },
        "version": {
          "type": "string",
          "pattern": "^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9.]+)?$"
        },
        "description": {
          "type": "string",
          "maxLength": 5000
        },
        "author": {
          "type": "object",
          "properties": {
            "id": { "type": "string", "format": "uuid" },
            "name": { "type": "string" },
            "email": { "type": "string", "format": "email" }
          }
        },
        "license": {
          "type": "string",
          "enum": ["MIT", "Apache-2.0", "GPL-3.0", "BSD-3-Clause", "ISC", "MPL-2.0"]
        },
        "keywords": {
          "type": "array",
          "items": { "type": "string" },
          "maxItems": 20
        },
        "homepage": {
          "type": "string",
          "format": "uri"
        },
        "repository": {
          "type": "object",
          "properties": {
            "type": { "type": "string", "enum": ["git", "svn", "hg"] },
            "url": { "type": "string", "format": "uri" }
          }
        }
      }
    },
    "taxonomy": {
      "type": "object",
      "required": ["category", "language"],
      "properties": {
        "category": {
          "type": "string",
          "enum": [
            "authentication", "api", "data", "ui", "security",
            "cache", "queue", "storage", "analytics", "communication",
            "payment", "email", "sms", "notification", "search",
            "validation", "testing", "logging", "monitoring"
          ]
        },
        "subcategory": { "type": "string" },
        "language": {
          "type": "string",
          "enum": ["javascript", "typescript", "python", "go", "rust", "java", "c#", "php", "ruby"]
        },
        "framework": { "type": "string" },
        "tier": {
          "type": "string",
          "enum": ["frontend", "backend", "fullstack", "infrastructure", "devops"]
        },
        "tags": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "dependencies": {
      "type": "object",
      "properties": {
        "required": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string", "format": "uuid" },
              "name": { "type": "string" },
              "version": { "type": "string" }
            }
          }
        },
        "optional": { "type": "array" },
        "peer": { "type": "array" },
        "dev": { "type": "array" }
      }
    },
    "api": {
      "type": "object",
      "properties": {
        "exports": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "type": {
                "type": "string",
                "enum": ["function", "class", "constant", "type", "interface"]
              },
              "signature": { "type": "string" },
              "description": { "type": "string" },
              "parameters": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "name": { "type": "string" },
                    "type": { "type": "string" },
                    "required": { "type": "boolean" },
                    "default": {},
                    "description": { "type": "string" }
                  }
                }
              },
              "returns": {
                "type": "object",
                "properties": {
                  "type": { "type": "string" },
                  "description": { "type": "string" }
                }
              },
              "examples": {
                "type": "array",
                "items": { "type": "string" }
              }
            }
          }
        }
      }
    },
    "quality": {
      "type": "object",
      "properties": {
        "tests": {
          "type": "object",
          "properties": {
            "coverage": { "type": "number", "minimum": 0, "maximum": 100 },
            "passed": { "type": "integer" },
            "failed": { "type": "integer" }
          }
        },
        "security": {
          "type": "object",
          "properties": {
            "vulnerabilities": { "type": "integer" },
            "lastScan": { "type": "string", "format": "date-time" }
          }
        },
        "performance": {
          "type": "object",
          "properties": {
            "benchmark": { "type": "string" },
            "memoryUsage": { "type": "string" }
          }
        }
      }
    },
    "code": {
      "type": "object",
      "required": ["content"],
      "properties": {
        "content": { "type": "string" },
        "language": { "type": "string" },
        "size": { "type": "integer" }
      }
    }
  }
}
```

---

## 3. API Endpoints

### 3.1. Component Management

```
POST   /api/v1/components              Создать компонент
GET    /api/v1/components              Список компонентов
GET    /api/v1/components/:id          Получить компонент
PUT    /api/v1/components/:id          Обновить компонент
DELETE /api/v1/components/:id          Удалить компонент

GET    /api/v1/components/search       Поиск компонентов
GET    /api/v1/components/:id/download Скачать компонент
GET    /api/v1/components/:id/deps     Граф зависимостей
GET    /api/v1/components/:id/stats    Статистика компонента
```

### 3.2. Discovery & Search

```
GET    /api/v1/search                  Полнотекстовый поиск
GET    /api/v1/categories              Список категорий
GET    /api/v1/categories/:cat/components  Компоненты категории
GET    /api/v1/tags                    Популярные теги
GET    /api/v1/trending                Популярные компоненты
GET    /api/v1/recommendations         Рекомендации
```

### 3.3. Quality & Security

```
GET    /api/v1/components/:id/quality  Метрики качества
POST   /api/v1/components/:id/scan     Запустить сканирование
GET    /api/v1/components/:id/security Отчёт безопасности
GET    /api/v1/components/:id/duplicates Найти дубликаты
```

### 3.4. Dependencies

```
POST   /api/v1/resolve                 Разрешить зависимости
GET    /api/v1/components/:id/dependents  Кто зависит от компонента
GET    /api/v1/components/:id/tree     Дерево зависимостей
```

### 3.5. Applications

```
POST   /api/v1/applications            Создать приложение
GET    /api/v1/applications/:id        Получить приложение
POST   /api/v1/applications/:id/build  Собрать приложение
GET    /api/v1/applications/:id/components  Компоненты приложения
```

---

## 4. Пример GraphQL Schema

```graphql
type Component {
  id: ID!
  contentHash: String!
  name: String!
  version: String!
  description: String
  author: User!
  license: String

  # Taxonomy
  category: String!
  subcategory: String
  language: String!
  framework: String
  tier: String
  tags: [String!]!

  # Relations
  dependencies(type: DependencyType): [Dependency!]!
  dependents: [Component!]!
  duplicates(threshold: Float): [Duplicate!]!

  # Quality
  quality: QualityMetrics
  security: SecurityReport

  # Stats
  downloads: Int!
  stars: Int!
  reviews: [Review!]!
  averageRating: Float

  # Timestamps
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Dependency {
  component: Component!
  type: DependencyType!
  versionConstraint: String!
}

enum DependencyType {
  REQUIRED
  OPTIONAL
  PEER
  DEV
}

type QualityMetrics {
  testCoverage: Float
  securityScore: Int
  performanceScore: Int
  maintainabilityGrade: String
  complexity: Int
  linesOfCode: Int
}

type User {
  id: ID!
  username: String!
  email: String!
  fullName: String
  components: [Component!]!
  applications: [Application!]!
}

type Query {
  component(id: ID!): Component
  components(
    category: String
    language: String
    search: String
    limit: Int
    offset: Int
  ): [Component!]!

  searchComponents(
    query: String!
    filters: SearchFilters
  ): SearchResult!

  resolveDependencies(
    components: [ComponentInput!]!
  ): DependencyTree!
}

type Mutation {
  createComponent(input: ComponentInput!): Component!
  updateComponent(id: ID!, input: ComponentInput!): Component!
  deleteComponent(id: ID!): Boolean!

  scanComponent(id: ID!): QualityMetrics!

  createApplication(input: ApplicationInput!): Application!
  buildApplication(id: ID!): Build!
}

input SearchFilters {
  categories: [String!]
  languages: [String!]
  minRating: Float
  minDownloads: Int
  verified: Boolean
}
```

---

## 5. Elasticsearch Index Schema (для поиска)

```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "name": {
        "type": "text",
        "fields": {
          "keyword": { "type": "keyword" },
          "autocomplete": {
            "type": "text",
            "analyzer": "autocomplete"
          }
        }
      },
      "description": {
        "type": "text",
        "analyzer": "english"
      },
      "category": { "type": "keyword" },
      "subcategory": { "type": "keyword" },
      "language": { "type": "keyword" },
      "framework": { "type": "keyword" },
      "tags": { "type": "keyword" },
      "author": {
        "properties": {
          "id": { "type": "keyword" },
          "username": { "type": "keyword" }
        }
      },
      "downloads": { "type": "integer" },
      "stars": { "type": "integer" },
      "rating": { "type": "float" },
      "created_at": { "type": "date" },
      "updated_at": { "type": "date" },
      "verified": { "type": "boolean" },
      "exports": {
        "type": "nested",
        "properties": {
          "name": { "type": "text" },
          "type": { "type": "keyword" },
          "signature": { "type": "text" }
        }
      }
    }
  },
  "settings": {
    "analysis": {
      "analyzer": {
        "autocomplete": {
          "tokenizer": "autocomplete_tokenizer",
          "filter": ["lowercase"]
        }
      },
      "tokenizer": {
        "autocomplete_tokenizer": {
          "type": "edge_ngram",
          "min_gram": 2,
          "max_gram": 10,
          "token_chars": ["letter", "digit"]
        }
      }
    }
  }
}
```

---

## 6. Redis Cache Strategy

```javascript
// Ключи для кэширования
const CACHE_KEYS = {
  component: (id) => `component:${id}`,
  componentByHash: (hash) => `component:hash:${hash}`,
  userComponents: (userId) => `user:${userId}:components`,
  trending: (period) => `trending:${period}`,  // hour, day, week
  dependencies: (id) => `deps:${id}`,
  stats: (id) => `stats:${id}`,
  search: (query, filters) => `search:${hash(query + JSON.stringify(filters))}`
};

// TTL (Time To Live)
const CACHE_TTL = {
  component: 3600,           // 1 hour
  componentByHash: 86400,    // 24 hours (immutable)
  userComponents: 300,       // 5 minutes
  trending: 600,             // 10 minutes
  dependencies: 3600,        // 1 hour
  stats: 300,                // 5 minutes
  search: 600                // 10 minutes
};
```

---

Эта структура данных обеспечивает:
1. **Нормализацию** — минимальное дублирование данных
2. **Производительность** — индексы для быстрых запросов
3. **Масштабируемость** — поддержка миллионов компонентов
4. **Гибкость** — JSONB для расширяемых метаданных
5. **Целостность** — foreign keys и constraints
6. **Аналитику** — статистика и метрики
