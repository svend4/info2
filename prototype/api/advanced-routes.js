/**
 * Advanced API Routes for T-Hub
 * Includes Elasticsearch search, caching, and metrics endpoints
 */

const ElasticsearchService = require('../search/elasticsearch');
const { getCache } = require('../cache/redis');
const metricsService = require('../monitoring/metrics');

/**
 * Setup advanced routes with search, caching, and metrics
 * @param {Express} app - Express application
 * @param {ComponentRepository} componentRepo - Component repository
 * @param {object} logger - Winston logger
 */
async function setupAdvancedRoutes(app, componentRepo, logger) {
  // Initialize services
  const searchService = new ElasticsearchService();
  const cache = getCache();

  let searchEnabled = false;
  let cacheEnabled = false;

  // Try to initialize Elasticsearch
  try {
    await searchService.initialize();
    searchEnabled = true;
    logger.info('✓ Elasticsearch initialized');
  } catch (error) {
    logger.warn('⊘ Elasticsearch not available, using fallback search');
  }

  // Try to initialize Redis cache
  try {
    await cache.connect();
    cacheEnabled = true;
    logger.info('✓ Redis cache initialized');
  } catch (error) {
    logger.warn('⊘ Redis not available, caching disabled');
  }

  // =========================================================================
  // Advanced Search Endpoints
  // =========================================================================

  /**
   * POST /api/v1/search/advanced - Advanced search with filters
   */
  app.post('/api/v1/search/advanced', async (req, res) => {
    try {
      const { query, category, language, tags, minStars, minDownloads, author, sort, from, size } = req.body;

      if (!searchEnabled) {
        return res.status(503).json({
          error: 'Search service unavailable',
          message: 'Elasticsearch is not configured'
        });
      }

      // Check cache first
      const cacheKey = `search:advanced:${JSON.stringify(req.body)}`;
      if (cacheEnabled) {
        const cached = await cache.get(cacheKey);
        if (cached) {
          metricsService.recordCacheHit('search');
          return res.json({ ...cached, cached: true });
        }
        metricsService.recordCacheMiss('search');
      }

      const startTime = Date.now();

      const results = await searchService.search({
        query,
        category,
        language,
        tags,
        minStars,
        minDownloads,
        author,
        sort,
        from: from || 0,
        size: size || 10
      });

      const duration = (Date.now() - startTime) / 1000;

      // Record metrics
      metricsService.recordSearch('advanced', duration, results.total);

      // Cache results
      if (cacheEnabled) {
        await cache.set(cacheKey, results, cache.TTL.SEARCH);
      }

      res.json(results);
    } catch (error) {
      logger.error('Advanced search error:', error);
      res.status(500).json({
        error: 'Search failed',
        message: error.message
      });
    }
  });

  /**
   * GET /api/v1/search/autocomplete - Autocomplete suggestions
   */
  app.get('/api/v1/search/autocomplete', async (req, res) => {
    try {
      const { q, limit = 5 } = req.query;

      if (!q) {
        return res.status(400).json({
          error: 'Missing query parameter "q"'
        });
      }

      if (!searchEnabled) {
        // Fallback to database
        const results = await componentRepo.search(q, parseInt(limit));
        return res.json({
          suggestions: results.results.map(r => ({
            name: r.name,
            description: r.description,
            category: r.category
          }))
        });
      }

      const suggestions = await searchService.autocomplete(q, parseInt(limit));

      res.json({ suggestions });
    } catch (error) {
      logger.error('Autocomplete error:', error);
      res.status(500).json({
        error: 'Autocomplete failed',
        message: error.message
      });
    }
  });

  /**
   * GET /api/v1/components/:id/similar - Find similar components
   */
  app.get('/api/v1/components/:id/similar', async (req, res) => {
    try {
      const { limit = 5 } = req.query;

      if (!searchEnabled) {
        return res.json({
          similar: [],
          message: 'Similar search requires Elasticsearch'
        });
      }

      const similar = await searchService.findSimilar(req.params.id, parseInt(limit));

      res.json({ similar });
    } catch (error) {
      logger.error('Similar search error:', error);
      res.status(500).json({
        error: 'Similar search failed',
        message: error.message
      });
    }
  });

  // =========================================================================
  // Cache Management Endpoints
  // =========================================================================

  /**
   * GET /api/v1/cache/stats - Get cache statistics
   */
  app.get('/api/v1/cache/stats', async (req, res) => {
    try {
      if (!cacheEnabled) {
        return res.json({
          enabled: false,
          message: 'Redis cache is not configured'
        });
      }

      const stats = await cache.getCacheStats();

      res.json({
        enabled: true,
        ...stats
      });
    } catch (error) {
      logger.error('Cache stats error:', error);
      res.status(500).json({
        error: 'Failed to get cache stats'
      });
    }
  });

  /**
   * DELETE /api/v1/cache/flush - Flush all cache (admin only)
   */
  app.delete('/api/v1/cache/flush', async (req, res) => {
    try {
      if (!cacheEnabled) {
        return res.json({
          message: 'Cache is not enabled'
        });
      }

      await cache.flushAll();

      logger.info('Cache flushed');

      res.json({
        message: 'Cache flushed successfully'
      });
    } catch (error) {
      logger.error('Cache flush error:', error);
      res.status(500).json({
        error: 'Failed to flush cache'
      });
    }
  });

  // =========================================================================
  // Metrics Endpoints
  // =========================================================================

  /**
   * GET /metrics - Prometheus metrics endpoint
   */
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', metricsService.getContentType());
      const metrics = await metricsService.getMetrics();
      res.send(metrics);
    } catch (error) {
      logger.error('Metrics error:', error);
      res.status(500).json({
        error: 'Failed to get metrics'
      });
    }
  });

  /**
   * GET /api/v1/metrics - Metrics in JSON format
   */
  app.get('/api/v1/metrics', async (req, res) => {
    try {
      const metrics = await metricsService.getMetricsJSON();
      res.json({ metrics });
    } catch (error) {
      logger.error('Metrics JSON error:', error);
      res.status(500).json({
        error: 'Failed to get metrics'
      });
    }
  });

  // =========================================================================
  // System Health Endpoints
  // =========================================================================

  /**
   * GET /api/v1/health/detailed - Detailed health check
   */
  app.get('/api/v1/health/detailed', async (req, res) => {
    try {
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '0.1.0',
        services: {}
      };

      // Check database
      const db = require('../db').getDatabase();
      const dbHealthy = await db.testConnection();
      health.services.database = {
        status: dbHealthy ? 'healthy' : 'unhealthy',
        type: 'PostgreSQL'
      };

      // Check Redis
      if (cacheEnabled) {
        const cacheHealth = await cache.healthCheck();
        health.services.cache = {
          status: cacheHealth.status === 'connected' ? 'healthy' : 'unhealthy',
          type: 'Redis'
        };
      } else {
        health.services.cache = {
          status: 'disabled',
          type: 'Redis'
        };
      }

      // Check Elasticsearch
      if (searchEnabled) {
        const searchHealth = await searchService.healthCheck();
        health.services.search = {
          status: searchHealth.status === 'green' || searchHealth.status === 'yellow' ? 'healthy' : 'unhealthy',
          type: 'Elasticsearch',
          ...searchHealth
        };
      } else {
        health.services.search = {
          status: 'disabled',
          type: 'Elasticsearch'
        };
      }

      // Overall status
      const servicesHealthy = Object.values(health.services).every(
        s => s.status === 'healthy' || s.status === 'disabled'
      );

      health.status = servicesHealthy ? 'healthy' : 'degraded';

      const statusCode = servicesHealthy ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      logger.error('Health check error:', error);
      res.status(500).json({
        status: 'error',
        error: error.message
      });
    }
  });

  // =========================================================================
  // Indexing Operations (for syncing Elasticsearch)
  // =========================================================================

  /**
   * POST /api/v1/admin/reindex - Reindex all components in Elasticsearch
   */
  app.post('/api/v1/admin/reindex', async (req, res) => {
    try {
      if (!searchEnabled) {
        return res.status(503).json({
          error: 'Search service unavailable'
        });
      }

      logger.info('Starting reindex operation...');

      // Get all components from database
      const { data: components } = await componentRepo.findAll({
        limit: 10000,
        offset: 0
      });

      // Bulk index to Elasticsearch
      await searchService.bulkIndex(components);

      logger.info(`Reindexed ${components.length} components`);

      res.json({
        message: 'Reindex completed',
        count: components.length
      });
    } catch (error) {
      logger.error('Reindex error:', error);
      res.status(500).json({
        error: 'Reindex failed',
        message: error.message
      });
    }
  });

  /**
   * GET /api/v1/admin/search-stats - Get Elasticsearch statistics
   */
  app.get('/api/v1/admin/search-stats', async (req, res) => {
    try {
      if (!searchEnabled) {
        return res.json({
          enabled: false,
          message: 'Elasticsearch is not configured'
        });
      }

      const stats = await searchService.getStats();

      res.json({
        enabled: true,
        ...stats
      });
    } catch (error) {
      logger.error('Search stats error:', error);
      res.status(500).json({
        error: 'Failed to get search stats'
      });
    }
  });

  // Return services for use in server
  return {
    searchService,
    cache,
    searchEnabled,
    cacheEnabled
  };
}

module.exports = setupAdvancedRoutes;
