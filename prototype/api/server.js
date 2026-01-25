/**
 * T-Hub REST API Server
 *
 * Основной API сервер для работы с реестром компонентов
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { createLogger, format, transports } = require('winston');

// Middleware
const app = express();

// Логирование
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' })
  ]
});

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // CORS
app.use(compression()); // Gzip compression
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ============================================================================
// ROUTES: Health Check
// ============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '0.1.0'
  });
});

app.get('/api/v1/status', (req, res) => {
  res.json({
    api: 'T-Hub API',
    version: '1.0.0',
    components: {
      registry: 'operational',
      deduplication: 'operational',
      search: 'operational'
    }
  });
});

// ============================================================================
// ROUTES: Components
// ============================================================================

// Моковые данные для демонстрации
const mockComponents = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    content_hash: 'sha256:a3f5c8b9d2e1f4a7c6b8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0',
    name: 'jwt-generator',
    version: '2.1.3',
    description: 'JWT token generation and validation',
    author: {
      id: '660e8400-e29b-41d4-a716-446655440002',
      name: 'John Doe',
      email: 'john@example.com'
    },
    category: 'authentication',
    language: 'javascript',
    license: 'MIT',
    downloads: 1523456,
    stars: 8234,
    created_at: '2024-01-15T10:30:00Z',
    updated_at: '2024-03-20T14:45:00Z'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    content_hash: 'sha256:b4c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7',
    name: 'oauth2-provider',
    version: '3.0.1',
    description: 'OAuth 2.0 provider implementation',
    author: {
      id: '660e8400-e29b-41d4-a716-446655440003',
      name: 'Jane Smith',
      email: 'jane@example.com'
    },
    category: 'authentication',
    language: 'javascript',
    license: 'Apache-2.0',
    downloads: 892341,
    stars: 5432,
    created_at: '2024-02-10T08:20:00Z',
    updated_at: '2024-03-15T11:30:00Z'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    content_hash: 'sha256:c5d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8',
    name: 'postgres-orm',
    version: '5.1.2',
    description: 'PostgreSQL ORM with TypeScript support',
    author: {
      id: '660e8400-e29b-41d4-a716-446655440004',
      name: 'Bob Wilson',
      email: 'bob@example.com'
    },
    category: 'data',
    language: 'typescript',
    license: 'MIT',
    downloads: 2341567,
    stars: 12345,
    created_at: '2023-11-05T14:15:00Z',
    updated_at: '2024-03-18T09:45:00Z'
  }
];

// GET /api/v1/components - Список компонентов
app.get('/api/v1/components', (req, res) => {
  const {
    category,
    language,
    search,
    limit = 10,
    offset = 0
  } = req.query;

  let filtered = [...mockComponents];

  // Фильтрация по категории
  if (category) {
    filtered = filtered.filter(c => c.category === category);
  }

  // Фильтрация по языку
  if (language) {
    filtered = filtered.filter(c => c.language === language);
  }

  // Поиск
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(c =>
      c.name.toLowerCase().includes(searchLower) ||
      c.description.toLowerCase().includes(searchLower)
    );
  }

  // Пагинация
  const total = filtered.length;
  const paginated = filtered.slice(
    parseInt(offset),
    parseInt(offset) + parseInt(limit)
  );

  res.json({
    data: paginated,
    pagination: {
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: (parseInt(offset) + parseInt(limit)) < total
    }
  });
});

// GET /api/v1/components/:id - Получить компонент
app.get('/api/v1/components/:id', (req, res) => {
  const component = mockComponents.find(c => c.id === req.params.id);

  if (!component) {
    return res.status(404).json({
      error: 'Component not found',
      id: req.params.id
    });
  }

  // Расширенная информация
  const detailed = {
    ...component,
    dependencies: [
      {
        id: '550e8400-e29b-41d4-a716-446655440099',
        name: 'crypto-utils',
        version: '^3.0.0'
      }
    ],
    exports: [
      {
        name: 'generateToken',
        type: 'function',
        signature: '(payload: object, secret: string, options?: object) => string'
      },
      {
        name: 'verifyToken',
        type: 'function',
        signature: '(token: string, secret: string) => object | null'
      }
    ],
    quality: {
      testCoverage: 95.2,
      securityScore: 98,
      maintainability: 'A'
    }
  };

  res.json(detailed);
});

// POST /api/v1/components - Создать компонент
app.post('/api/v1/components', (req, res) => {
  const { name, version, description, category, language, code } = req.body;

  // Валидация
  if (!name || !version || !code) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['name', 'version', 'code']
    });
  }

  // Создание нового компонента (мок)
  const newComponent = {
    id: `550e8400-e29b-41d4-a716-${Date.now()}`,
    content_hash: `sha256:${Buffer.from(code).toString('hex').substring(0, 64)}`,
    name,
    version,
    description,
    category: category || 'utilities',
    language: language || 'javascript',
    license: 'MIT',
    downloads: 0,
    stars: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  mockComponents.push(newComponent);

  logger.info(`Component created: ${name}@${version}`);

  res.status(201).json({
    message: 'Component created successfully',
    component: newComponent
  });
});

// PUT /api/v1/components/:id - Обновить компонент
app.put('/api/v1/components/:id', (req, res) => {
  const index = mockComponents.findIndex(c => c.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({
      error: 'Component not found'
    });
  }

  const updated = {
    ...mockComponents[index],
    ...req.body,
    updated_at: new Date().toISOString()
  };

  mockComponents[index] = updated;

  res.json({
    message: 'Component updated successfully',
    component: updated
  });
});

// DELETE /api/v1/components/:id - Удалить компонент
app.delete('/api/v1/components/:id', (req, res) => {
  const index = mockComponents.findIndex(c => c.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({
      error: 'Component not found'
    });
  }

  const deleted = mockComponents.splice(index, 1)[0];

  res.json({
    message: 'Component deleted successfully',
    component: deleted
  });
});

// GET /api/v1/components/:id/download - Скачать компонент
app.get('/api/v1/components/:id/download', (req, res) => {
  const component = mockComponents.find(c => c.id === req.params.id);

  if (!component) {
    return res.status(404).json({
      error: 'Component not found'
    });
  }

  // Моковый код компонента
  const code = `
/**
 * ${component.name}@${component.version}
 * ${component.description}
 */

module.exports = {
  // Component implementation
};
  `.trim();

  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Content-Disposition', `attachment; filename="${component.name}-${component.version}.js"`);
  res.send(code);
});

// ============================================================================
// ROUTES: Search
// ============================================================================

app.get('/api/v1/search', (req, res) => {
  const { q, category, language, limit = 10 } = req.query;

  if (!q) {
    return res.status(400).json({
      error: 'Missing search query parameter "q"'
    });
  }

  const searchLower = q.toLowerCase();
  let results = mockComponents.filter(c =>
    c.name.toLowerCase().includes(searchLower) ||
    c.description.toLowerCase().includes(searchLower)
  );

  if (category) {
    results = results.filter(c => c.category === category);
  }

  if (language) {
    results = results.filter(c => c.language === language);
  }

  results = results.slice(0, parseInt(limit));

  res.json({
    query: q,
    results,
    total: results.length
  });
});

// ============================================================================
// ROUTES: Categories
// ============================================================================

app.get('/api/v1/categories', (req, res) => {
  const categories = [...new Set(mockComponents.map(c => c.category))];

  const categoriesWithCounts = categories.map(cat => ({
    name: cat,
    count: mockComponents.filter(c => c.category === cat).length
  }));

  res.json({
    categories: categoriesWithCounts
  });
});

// ============================================================================
// ROUTES: Dependencies
// ============================================================================

app.post('/api/v1/resolve', (req, res) => {
  const { components } = req.body;

  if (!components || !Array.isArray(components)) {
    return res.status(400).json({
      error: 'Invalid request body. Expected { components: [...] }'
    });
  }

  // Моковое разрешение зависимостей
  const resolved = components.map(comp => ({
    name: comp.name || comp,
    version: comp.version || 'latest',
    resolved_version: '1.0.0',
    dependencies: []
  }));

  res.json({
    resolved,
    graph: {
      nodes: resolved.map(r => ({ id: `${r.name}@${r.resolved_version}` })),
      edges: []
    }
  });
});

app.get('/api/v1/components/:id/dependents', (req, res) => {
  // Моковые зависимые компоненты
  res.json({
    dependents: [
      {
        id: '550e8400-e29b-41d4-a716-446655440099',
        name: 'user-auth-service',
        version: '1.5.2'
      }
    ],
    total: 1
  });
});

// ============================================================================
// ROUTES: Statistics
// ============================================================================

app.get('/api/v1/stats', (req, res) => {
  res.json({
    totalComponents: mockComponents.length,
    totalDownloads: mockComponents.reduce((sum, c) => sum + c.downloads, 0),
    totalStars: mockComponents.reduce((sum, c) => sum + c.stars, 0),
    categories: {
      authentication: mockComponents.filter(c => c.category === 'authentication').length,
      data: mockComponents.filter(c => c.category === 'data').length
    },
    languages: {
      javascript: mockComponents.filter(c => c.language === 'javascript').length,
      typescript: mockComponents.filter(c => c.language === 'typescript').length
    }
  });
});

// ============================================================================
// ROUTES: Trending
// ============================================================================

app.get('/api/v1/trending', (req, res) => {
  const { period = 'week', limit = 10 } = req.query;

  // Сортировка по популярности (downloads + stars)
  const trending = [...mockComponents]
    .sort((a, b) => (b.downloads + b.stars * 10) - (a.downloads + a.stars * 10))
    .slice(0, parseInt(limit));

  res.json({
    period,
    trending
  });
});

// ============================================================================
// Error handling
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(err.stack);

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================================================
// Server startup
// ============================================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`🚀 T-Hub API Server running on port ${PORT}`);
  logger.info(`📚 API Documentation: http://localhost:${PORT}/api/v1/status`);
  logger.info(`💚 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
