/**
 * T-Hub REST API Server
 *
 * Основной API сервер для работы с реестром компонентов
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const swaggerUi = require('swagger-ui-express');
const { createLogger, format, transports } = require('winston');
const { getDatabase, ComponentRepository, UserRepository } = require('../db');
const {
  hashPassword,
  verifyPassword,
  generateToken,
  authenticate,
  optionalAuthenticate,
  authorize,
  validateRegistration,
  authRateLimit
} = require('./auth');

// Initialize database
const db = getDatabase();
const componentRepo = new ComponentRepository(db);
const userRepo = new UserRepository(db);

// Load Swagger spec
const swaggerDocument = require('./swagger.json');

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

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customSiteTitle: 'T-Hub API Documentation',
  customCss: '.swagger-ui .topbar { display: none }'
}));

// ============================================================================
// ROUTES: Health Check
// ============================================================================

app.get('/health', async (req, res) => {
  const dbHealthy = await db.testConnection();

  res.json({
    status: dbHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '0.1.0',
    database: dbHealthy ? 'connected' : 'disconnected'
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
// ROUTES: Authentication
// ============================================================================

// POST /api/v1/auth/register - Register new user
app.post('/api/v1/auth/register', authRateLimit, async (req, res) => {
  try {
    const { username, email, password, full_name } = req.body;

    // Validate input
    const validation = validateRegistration({ username, email, password });
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        errors: validation.errors
      });
    }

    // Check if user already exists
    const existingUser = await userRepo.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'A user with this email address already exists'
      });
    }

    const existingUsername = await userRepo.findByUsername(username);
    if (existingUsername) {
      return res.status(409).json({
        error: 'Username taken',
        message: 'This username is already taken'
      });
    }

    // Hash password and create user
    const password_hash = await hashPassword(password);
    const user = await userRepo.create({
      username,
      email,
      password_hash,
      full_name
    });

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      role: 'user'
    });

    logger.info(`User registered: ${username}`);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name
      },
      token
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'An error occurred during registration'
    });
  }
});

// POST /api/v1/auth/login - User login
app.post('/api/v1/auth/login', authRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Email and password are required'
      });
    }

    // Find user
    const user = await userRepo.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({
        error: 'Account disabled',
        message: 'Your account has been disabled'
      });
    }

    // Update last login
    await userRepo.updateLastLogin(user.id);

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });

    logger.info(`User logged in: ${user.username}`);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      },
      token
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'An error occurred during login'
    });
  }
});

// GET /api/v1/auth/me - Get current user
app.get('/api/v1/auth/me', authenticate, async (req, res) => {
  try {
    const user = await userRepo.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({ user });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to get user information'
    });
  }
});

// ============================================================================
// ROUTES: Components
// ============================================================================

// GET /api/v1/components - Список компонентов
app.get('/api/v1/components', async (req, res) => {
  try {
    const result = await componentRepo.findAll(req.query);
    res.json(result);
  } catch (error) {
    logger.error('Error fetching components:', error);
    res.status(500).json({
      error: 'Failed to fetch components',
      message: error.message
    });
  }
});

// GET /api/v1/components/:id - Получить компонент
app.get('/api/v1/components/:id', async (req, res) => {
  try {
    const component = await componentRepo.findById(req.params.id);

    if (!component) {
      return res.status(404).json({
        error: 'Component not found',
        id: req.params.id
      });
    }

    res.json(component);
  } catch (error) {
    logger.error('Error fetching component:', error);
    res.status(500).json({
      error: 'Failed to fetch component',
      message: error.message
    });
  }
});

// POST /api/v1/components - Создать компонент
app.post('/api/v1/components', authenticate, async (req, res) => {
  try {
    const { name, version, description, readme, category, language, code, license } = req.body;

    // Валидация
    if (!name || !version || !code) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'version', 'code']
      });
    }

    // Calculate content hash
    const crypto = require('crypto');
    const content_hash = crypto.createHash('sha256').update(code).digest('hex');

    // Check for duplicate by content hash
    const existing = await componentRepo.findByContentHash(content_hash);
    if (existing) {
      return res.status(409).json({
        error: 'Duplicate component',
        message: 'A component with identical code already exists',
        existing: {
          id: existing.id,
          name: existing.name,
          version: existing.version
        }
      });
    }

    // Create component
    const newComponent = await componentRepo.create({
      content_hash,
      name,
      version,
      description,
      readme,
      category: category || 'Utilities',
      language: language || 'JavaScript',
      license: license || 'MIT',
      author_id: req.user.id,
      code_content: code,
      size_bytes: Buffer.byteLength(code, 'utf8')
    });

    logger.info(`Component created: ${name}@${version} by ${req.user.username}`);

    res.status(201).json({
      message: 'Component created successfully',
      component: newComponent
    });
  } catch (error) {
    logger.error('Error creating component:', error);
    res.status(500).json({
      error: 'Failed to create component',
      message: error.message
    });
  }
});

// PUT /api/v1/components/:id - Обновить компонент
app.put('/api/v1/components/:id', authenticate, async (req, res) => {
  try {
    const component = await componentRepo.findById(req.params.id);

    if (!component) {
      return res.status(404).json({
        error: 'Component not found'
      });
    }

    // Check if user is the author or admin
    if (component.author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update your own components'
      });
    }

    const updated = await componentRepo.update(req.params.id, req.body);

    logger.info(`Component updated: ${component.name}@${component.version} by ${req.user.username}`);

    res.json({
      message: 'Component updated successfully',
      component: updated
    });
  } catch (error) {
    logger.error('Error updating component:', error);
    res.status(500).json({
      error: 'Failed to update component',
      message: error.message
    });
  }
});

// DELETE /api/v1/components/:id - Удалить компонент
app.delete('/api/v1/components/:id', authenticate, authorize('admin', 'moderator'), async (req, res) => {
  try {
    const component = await componentRepo.findById(req.params.id);

    if (!component) {
      return res.status(404).json({
        error: 'Component not found'
      });
    }

    // Only admins and moderators can delete components
    await componentRepo.delete(req.params.id);

    logger.info(`Component deleted: ${component.name}@${component.version} by ${req.user.username}`);

    res.json({
      message: 'Component deleted successfully',
      component: {
        id: component.id,
        name: component.name,
        version: component.version
      }
    });
  } catch (error) {
    logger.error('Error deleting component:', error);
    res.status(500).json({
      error: 'Failed to delete component',
      message: error.message
    });
  }
});

// GET /api/v1/components/:id/download - Скачать компонент
app.get('/api/v1/components/:id/download', optionalAuthenticate, async (req, res) => {
  try {
    const component = await componentRepo.findById(req.params.id);

    if (!component) {
      return res.status(404).json({
        error: 'Component not found'
      });
    }

    // Track download
    const userId = req.user ? req.user.id : null;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await componentRepo.incrementDownloads(req.params.id, userId, ipAddress, userAgent);

    logger.info(`Component downloaded: ${component.name}@${component.version}`);

    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Content-Disposition', `attachment; filename="${component.name}-${component.version}.js"`);
    res.send(component.code_content);
  } catch (error) {
    logger.error('Error downloading component:', error);
    res.status(500).json({
      error: 'Failed to download component',
      message: error.message
    });
  }
});

// ============================================================================
// ROUTES: Search
// ============================================================================

app.get('/api/v1/search', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({
        error: 'Missing search query parameter "q"'
      });
    }

    const result = await componentRepo.search(q, parseInt(limit));
    res.json(result);
  } catch (error) {
    logger.error('Error searching components:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
});

// ============================================================================
// ROUTES: Categories
// ============================================================================

app.get('/api/v1/categories', async (req, res) => {
  try {
    const stats = await componentRepo.getStats();
    const categories = Object.entries(stats.categories).map(([name, count]) => ({
      name,
      count
    }));

    res.json({ categories });
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({
      error: 'Failed to fetch categories',
      message: error.message
    });
  }
});

// ============================================================================
// ROUTES: Dependencies
// ============================================================================

app.post('/api/v1/resolve', async (req, res) => {
  try {
    const { components } = req.body;

    if (!components || !Array.isArray(components)) {
      return res.status(400).json({
        error: 'Invalid request body. Expected { components: [...] }'
      });
    }

    // TODO: Implement actual dependency resolution using DependencyResolver
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
  } catch (error) {
    logger.error('Error resolving dependencies:', error);
    res.status(500).json({
      error: 'Failed to resolve dependencies',
      message: error.message
    });
  }
});

app.get('/api/v1/components/:id/dependents', async (req, res) => {
  try {
    const dependents = await componentRepo.getDependents(req.params.id);

    res.json({
      dependents,
      total: dependents.length
    });
  } catch (error) {
    logger.error('Error fetching dependents:', error);
    res.status(500).json({
      error: 'Failed to fetch dependents',
      message: error.message
    });
  }
});

// ============================================================================
// ROUTES: Statistics
// ============================================================================

app.get('/api/v1/stats', async (req, res) => {
  try {
    const stats = await componentRepo.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

// ============================================================================
// ROUTES: Trending
// ============================================================================

app.get('/api/v1/trending', async (req, res) => {
  try {
    const { period = 'week', limit = 10 } = req.query;
    const trending = await componentRepo.getTrending(period, parseInt(limit));

    res.json({
      period,
      trending
    });
  } catch (error) {
    logger.error('Error fetching trending components:', error);
    res.status(500).json({
      error: 'Failed to fetch trending components',
      message: error.message
    });
  }
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

async function startServer() {
  try {
    // Test database connection
    logger.info('Testing database connection...');
    const connected = await db.testConnection();

    if (!connected) {
      logger.error('Failed to connect to database');
      process.exit(1);
    }

    // Run migrations
    if (process.env.RUN_MIGRATIONS !== 'false') {
      logger.info('Running database migrations...');
      await db.migrate();
    }

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 T-Hub API Server running on port ${PORT}`);
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      logger.info(`📊 API Status: http://localhost:${PORT}/api/v1/status`);
      logger.info(`💚 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  await db.close();
  process.exit(0);
});

startServer();

module.exports = app;
