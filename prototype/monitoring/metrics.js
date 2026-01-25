/**
 * Prometheus Metrics for T-Hub
 * Provides performance and business metrics
 */

const prometheus = require('prom-client');

class MetricsService {
  constructor() {
    // Enable default metrics (CPU, memory, etc.)
    prometheus.collectDefaultMetrics({
      prefix: 'thub_',
      timeout: 5000
    });

    // Create custom metrics
    this.initializeMetrics();
  }

  initializeMetrics() {
    // ========================================================================
    // HTTP Metrics
    // ========================================================================

    this.httpRequestDuration = new prometheus.Histogram({
      name: 'thub_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
    });

    this.httpRequestTotal = new prometheus.Counter({
      name: 'thub_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code']
    });

    this.httpRequestsInProgress = new prometheus.Gauge({
      name: 'thub_http_requests_in_progress',
      help: 'Number of HTTP requests currently being processed',
      labelNames: ['method', 'route']
    });

    // ========================================================================
    // Business Metrics
    // ========================================================================

    this.componentsTotal = new prometheus.Gauge({
      name: 'thub_components_total',
      help: 'Total number of components in registry'
    });

    this.componentDownloads = new prometheus.Counter({
      name: 'thub_component_downloads_total',
      help: 'Total number of component downloads',
      labelNames: ['component_name', 'component_version']
    });

    this.componentUploads = new prometheus.Counter({
      name: 'thub_component_uploads_total',
      help: 'Total number of component uploads',
      labelNames: ['category', 'language']
    });

    this.componentDuplicates = new prometheus.Counter({
      name: 'thub_component_duplicates_total',
      help: 'Total number of duplicate component rejections',
      labelNames: ['similarity_type']
    });

    this.usersTotal = new prometheus.Gauge({
      name: 'thub_users_total',
      help: 'Total number of registered users'
    });

    this.userRegistrations = new prometheus.Counter({
      name: 'thub_user_registrations_total',
      help: 'Total number of user registrations'
    });

    this.userLogins = new prometheus.Counter({
      name: 'thub_user_logins_total',
      help: 'Total number of successful logins'
    });

    this.authFailures = new prometheus.Counter({
      name: 'thub_auth_failures_total',
      help: 'Total number of authentication failures',
      labelNames: ['reason']
    });

    // ========================================================================
    // Database Metrics
    // ========================================================================

    this.dbQueryDuration = new prometheus.Histogram({
      name: 'thub_db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
    });

    this.dbQueriesTotal = new prometheus.Counter({
      name: 'thub_db_queries_total',
      help: 'Total number of database queries',
      labelNames: ['operation', 'status']
    });

    this.dbConnectionsActive = new prometheus.Gauge({
      name: 'thub_db_connections_active',
      help: 'Number of active database connections'
    });

    // ========================================================================
    // Cache Metrics
    // ========================================================================

    this.cacheHits = new prometheus.Counter({
      name: 'thub_cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_type']
    });

    this.cacheMisses = new prometheus.Counter({
      name: 'thub_cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_type']
    });

    this.cacheSize = new prometheus.Gauge({
      name: 'thub_cache_size_bytes',
      help: 'Current cache size in bytes',
      labelNames: ['cache_type']
    });

    // ========================================================================
    // Search Metrics
    // ========================================================================

    this.searchQueries = new prometheus.Counter({
      name: 'thub_search_queries_total',
      help: 'Total number of search queries',
      labelNames: ['search_type']
    });

    this.searchDuration = new prometheus.Histogram({
      name: 'thub_search_duration_seconds',
      help: 'Duration of search queries in seconds',
      labelNames: ['search_type'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2]
    });

    this.searchResults = new prometheus.Histogram({
      name: 'thub_search_results_count',
      help: 'Number of results returned by search',
      labelNames: ['search_type'],
      buckets: [0, 1, 5, 10, 25, 50, 100, 500]
    });

    // ========================================================================
    // Deduplication Metrics
    // ========================================================================

    this.deduplicationChecks = new prometheus.Counter({
      name: 'thub_deduplication_checks_total',
      help: 'Total number of deduplication checks',
      labelNames: ['level']
    });

    this.deduplicationDuration = new prometheus.Histogram({
      name: 'thub_deduplication_duration_seconds',
      help: 'Duration of deduplication checks in seconds',
      labelNames: ['level'],
      buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1]
    });

    // ========================================================================
    // Dependency Resolution Metrics
    // ========================================================================

    this.dependencyResolutions = new prometheus.Counter({
      name: 'thub_dependency_resolutions_total',
      help: 'Total number of dependency resolutions',
      labelNames: ['status']
    });

    this.dependencyGraphSize = new prometheus.Histogram({
      name: 'thub_dependency_graph_size',
      help: 'Size of dependency graphs (number of nodes)',
      buckets: [1, 5, 10, 25, 50, 100, 500]
    });
  }

  // ========================================================================
  // Metric Recording Methods
  // ========================================================================

  recordHttpRequest(method, route, statusCode, duration) {
    this.httpRequestDuration.labels(method, route, statusCode).observe(duration);
    this.httpRequestTotal.labels(method, route, statusCode).inc();
  }

  recordComponentDownload(name, version) {
    this.componentDownloads.labels(name, version).inc();
  }

  recordComponentUpload(category, language) {
    this.componentUploads.labels(category, language).inc();
  }

  recordDuplicate(similarityType) {
    this.componentDuplicates.labels(similarityType).inc();
  }

  recordUserRegistration() {
    this.userRegistrations.inc();
  }

  recordUserLogin() {
    this.userLogins.inc();
  }

  recordAuthFailure(reason) {
    this.authFailures.labels(reason).inc();
  }

  recordDbQuery(operation, status, duration) {
    this.dbQueryDuration.labels(operation).observe(duration);
    this.dbQueriesTotal.labels(operation, status).inc();
  }

  recordCacheHit(cacheType) {
    this.cacheHits.labels(cacheType).inc();
  }

  recordCacheMiss(cacheType) {
    this.cacheMisses.labels(cacheType).inc();
  }

  recordSearch(searchType, duration, resultCount) {
    this.searchQueries.labels(searchType).inc();
    this.searchDuration.labels(searchType).observe(duration);
    this.searchResults.labels(searchType).observe(resultCount);
  }

  recordDeduplication(level, duration) {
    this.deduplicationChecks.labels(level).inc();
    this.deduplicationDuration.labels(level).observe(duration);
  }

  recordDependencyResolution(status, graphSize) {
    this.dependencyResolutions.labels(status).inc();
    if (graphSize !== undefined) {
      this.dependencyGraphSize.observe(graphSize);
    }
  }

  // ========================================================================
  // Gauge Update Methods
  // ========================================================================

  updateComponentsTotal(count) {
    this.componentsTotal.set(count);
  }

  updateUsersTotal(count) {
    this.usersTotal.set(count);
  }

  updateDbConnectionsActive(count) {
    this.dbConnectionsActive.set(count);
  }

  updateCacheSize(cacheType, size) {
    this.cacheSize.labels(cacheType).set(size);
  }

  // ========================================================================
  // Middleware
  // ========================================================================

  /**
   * Express middleware to track HTTP metrics
   */
  middleware() {
    return (req, res, next) => {
      const start = Date.now();
      const route = req.route?.path || req.path;

      // Track in-progress requests
      this.httpRequestsInProgress.labels(req.method, route).inc();

      // Capture response finish
      const originalSend = res.send;
      res.send = function (data) {
        const duration = (Date.now() - start) / 1000;

        // Record metrics
        metricsService.recordHttpRequest(
          req.method,
          route,
          res.statusCode,
          duration
        );

        metricsService.httpRequestsInProgress.labels(req.method, route).dec();

        return originalSend.call(this, data);
      };

      next();
    };
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics() {
    return await prometheus.register.metrics();
  }

  /**
   * Get metrics as JSON
   */
  async getMetricsJSON() {
    const metrics = await prometheus.register.getMetricsAsJSON();
    return metrics;
  }

  /**
   * Reset all metrics
   */
  reset() {
    prometheus.register.clear();
    this.initializeMetrics();
  }

  /**
   * Get content type for Prometheus
   */
  getContentType() {
    return prometheus.register.contentType;
  }
}

// Export singleton instance
const metricsService = new MetricsService();

module.exports = metricsService;
