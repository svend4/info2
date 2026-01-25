# T-Hub Advanced Features

This document describes the advanced features available in T-Hub beyond the basic component registry functionality.

## Table of Contents

- [Elasticsearch Integration](#elasticsearch-integration)
- [Redis Caching Layer](#redis-caching-layer)
- [Prometheus Metrics](#prometheus-metrics)
- [Advanced Components](#advanced-components)
- [API Reference](#api-reference)

## Elasticsearch Integration

T-Hub integrates with Elasticsearch to provide powerful search capabilities beyond simple text matching.

### Features

- **Full-text search** across component names, descriptions, and code
- **Fuzzy matching** to handle typos and variations
- **Autocomplete suggestions** for search-as-you-type
- **Find similar components** using More Like This queries
- **Faceted search** with aggregations by category, language, and tags
- **Custom analyzers** for code search
- **Wildcard support** in component names

### Setup

1. Install and start Elasticsearch 8.x:

```bash
# Using Docker
docker run -d -p 9200:9200 -p 9300:9300 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  --name elasticsearch \
  elasticsearch:8.10.0
```

2. Configure environment variables:

```env
ELASTICSEARCH_URL=http://localhost:9200
```

3. Initialize the index:

```bash
node -e "const ES = require('./search/elasticsearch'); const es = new ES(); es.initialize().then(() => console.log('Done'))"
```

4. Index existing components:

```bash
curl -X POST http://localhost:3000/api/v1/admin/reindex
```

### API Endpoints

#### Advanced Search

```bash
POST /api/v1/search/advanced
Content-Type: application/json

{
  "query": "authentication jwt",
  "category": "Authentication",
  "language": "JavaScript",
  "tags": ["security", "jwt"],
  "minStars": 10,
  "minDownloads": 100,
  "author": "john_doe",
  "sort": "relevance",
  "from": 0,
  "size": 10
}
```

Response includes:
- Matching components with relevance scores
- Highlighted snippets
- Aggregations (category, language, tag counts)

#### Autocomplete

```bash
GET /api/v1/search/autocomplete?q=auth&limit=5
```

Returns component name suggestions for autocomplete.

#### Find Similar

```bash
GET /api/v1/components/:id/similar?limit=5
```

Finds components similar to the specified component based on description, code, and tags.

### Search Strategies

**Relevance Ranking:**
- Name matches are boosted 3x
- Description matches are boosted 2x
- Tags are boosted 2x
- Fuzzy matching with AUTO fuzziness

**Sorting Options:**
- `relevance` - By search score (default)
- `downloads` - By download count
- `stars` - By star count
- `recent` - By creation date
- `updated` - By last update

### Performance

- Search queries typically complete in 10-50ms
- Autocomplete completes in 5-20ms
- Bulk indexing: ~1000 components/second
- Index size: ~1KB per component

## Redis Caching Layer

T-Hub uses Redis for multi-layer caching to improve performance and reduce database load.

### Features

- **Multi-layer caching** (L1: Memory, L2: Redis, L3: Database)
- **Automatic cache warming** - Popular data promoted to faster layers
- **Cache stampede prevention** with locking
- **Configurable TTLs** for different data types
- **Pattern-based invalidation**
- **Rate limiting** for API endpoints
- **Session storage** for authentication

### Setup

1. Install and start Redis:

```bash
# Using Docker
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

2. Configure environment:

```env
REDIS_URL=redis://localhost:6379
```

### Caching Strategy

| Data Type | TTL | Strategy |
|-----------|-----|----------|
| Component Details | 1 hour | Cache-aside |
| Component Lists | 5 minutes | Cache-aside |
| Search Results | 10 minutes | Cache-aside |
| Statistics | 5 minutes | Cache-aside |
| Trending | 10 minutes | Cache-through |
| User Sessions | 24 hours | Write-through |

### Cache Keys

```
component:{id}              # Individual component
components:list:{filters}   # Filtered component lists
search:{query}              # Search results
stats:global                # Global statistics
trending:{period}           # Trending components
user:{id}                   # User data
session:{sessionId}         # User sessions
ratelimit:{identifier}      # Rate limiting
```

### API Endpoints

#### Cache Statistics

```bash
GET /api/v1/cache/stats
```

Returns:
- Hit/miss ratios
- Total keys
- Memory usage
- Connection status

#### Flush Cache (Admin)

```bash
DELETE /api/v1/cache/flush
```

Clears all cached data.

### Performance Impact

- **Cache hit**: ~1-2ms response time
- **Cache miss**: ~50-100ms (database query)
- **Hit rate**: Typically 60-80% for read-heavy workloads
- **Bandwidth savings**: 50-70% reduction in database queries

## Prometheus Metrics

T-Hub exports comprehensive metrics in Prometheus format for monitoring and observability.

### Metrics Categories

#### HTTP Metrics

- `thub_http_request_duration_seconds` - Request latency histogram
- `thub_http_requests_total` - Total request counter
- `thub_http_requests_in_progress` - Active requests gauge

#### Business Metrics

- `thub_components_total` - Total components
- `thub_component_downloads_total` - Download counter
- `thub_component_uploads_total` - Upload counter
- `thub_component_duplicates_total` - Duplicate detection counter
- `thub_users_total` - Total users
- `thub_user_registrations_total` - Registration counter
- `thub_user_logins_total` - Login counter
- `thub_auth_failures_total` - Auth failure counter

#### Database Metrics

- `thub_db_query_duration_seconds` - Query latency histogram
- `thub_db_queries_total` - Query counter
- `thub_db_connections_active` - Active connections gauge

#### Cache Metrics

- `thub_cache_hits_total` - Cache hit counter
- `thub_cache_misses_total` - Cache miss counter
- `thub_cache_size_bytes` - Cache size gauge

#### Search Metrics

- `thub_search_queries_total` - Search query counter
- `thub_search_duration_seconds` - Search latency histogram
- `thub_search_results_count` - Result count histogram

#### Deduplication Metrics

- `thub_deduplication_checks_total` - Deduplication counter
- `thub_deduplication_duration_seconds` - Deduplication latency

#### Dependency Metrics

- `thub_dependency_resolutions_total` - Resolution counter
- `thub_dependency_graph_size` - Graph size histogram

### API Endpoints

#### Prometheus Format

```bash
GET /metrics
```

Returns metrics in Prometheus exposition format.

#### JSON Format

```bash
GET /api/v1/metrics
```

Returns metrics as JSON for debugging.

### Grafana Dashboard

Import the included Grafana dashboard for visualization:

1. Access Grafana at `http://localhost:3001` (default credentials: admin/admin)
2. Add Prometheus data source: `http://prometheus:9090`
3. Import dashboard from `monitoring/grafana-dashboard.json`

### Key Performance Indicators

**System Health:**
- Request latency p50, p95, p99
- Error rate
- Active connections

**Business Health:**
- Daily active users
- Component uploads/downloads
- Search query volume
- Cache hit rate

**Alerts:**
- High error rate (>1%)
- High latency (p99 >1s)
- Low cache hit rate (<50%)
- Database connection issues

## Advanced Components

T-Hub includes several advanced example components demonstrating best practices.

### cache-manager

Multi-layer caching system with memory and Redis backends.

**Features:**
- LRU/LFU/FIFO eviction policies
- Cache stampede prevention
- Automatic cache warming
- Sliding expiration
- Metrics and monitoring

**Usage:**

```javascript
const CacheManager = require('cache-manager');

const cache = new CacheManager({
  layers: ['memory', 'redis'],
  ttl: 3600,
  maxSize: 1000,
  evictionPolicy: 'lru'
});

// Get or compute
const data = await cache.getOrSet('key', async () => {
  return await expensiveOperation();
}, 7200);
```

### event-bus

Distributed event bus with pub/sub and request/reply patterns.

**Features:**
- Publish/Subscribe messaging
- Request/Reply (RPC)
- Message queuing with persistence
- Wildcard subscriptions
- Priority queues
- Dead letter queue
- Retry with exponential backoff
- Event replay

**Usage:**

```javascript
const EventBus = require('event-bus');

const bus = new EventBus();

// Subscribe to events
bus.subscribe('user.created', async (data) => {
  console.log('New user:', data);
});

// Wildcard subscription
bus.subscribe('user.*', async (data, event) => {
  console.log(`User event: ${event}`, data);
});

// Publish
await bus.publish('user.created', { id: 123 });

// Request/Reply
bus.handle('get.user', async (userId) => {
  return await db.getUser(userId);
});

const user = await bus.request('get.user', 123);
```

## API Reference

### Advanced Search

**POST /api/v1/search/advanced**

Advanced search with multiple filters and sorting.

**Request Body:**

```json
{
  "query": "string",
  "category": "string",
  "language": "string",
  "tags": ["string"],
  "minStars": 0,
  "minDownloads": 0,
  "author": "string",
  "sort": "relevance|downloads|stars|recent|updated",
  "from": 0,
  "size": 10
}
```

**Response:**

```json
{
  "total": 100,
  "results": [
    {
      "id": "uuid",
      "name": "component-name",
      "version": "1.0.0",
      "description": "...",
      "score": 1.234,
      "highlights": {
        "name": ["<em>highlighted</em>"],
        "description": ["..."]
      }
    }
  ],
  "aggregations": {
    "categories": [{"key": "Auth", "doc_count": 10}],
    "languages": [{"key": "JavaScript", "doc_count": 50}],
    "tags": [{"key": "security", "doc_count": 25}]
  }
}
```

### Health Check

**GET /api/v1/health/detailed**

Detailed health status of all services.

**Response:**

```json
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": "2024-01-20T12:00:00Z",
  "uptime": 3600,
  "version": "0.1.0",
  "services": {
    "database": {
      "status": "healthy",
      "type": "PostgreSQL"
    },
    "cache": {
      "status": "healthy",
      "type": "Redis"
    },
    "search": {
      "status": "healthy",
      "type": "Elasticsearch",
      "numberOfNodes": 1,
      "activeShards": 5
    }
  }
}
```

### Metrics

**GET /metrics**

Prometheus metrics in exposition format.

**GET /api/v1/metrics**

Metrics in JSON format.

### Admin Operations

**POST /api/v1/admin/reindex**

Reindex all components in Elasticsearch.

**Response:**

```json
{
  "message": "Reindex completed",
  "count": 1234
}
```

**GET /api/v1/admin/search-stats**

Get Elasticsearch index statistics.

**DELETE /api/v1/cache/flush**

Flush all cached data (requires admin privileges).

## Performance Best Practices

### Caching Strategy

1. **Use cache for read-heavy workloads** - Components, lists, search results
2. **Invalidate on writes** - Clear related caches when data changes
3. **Use appropriate TTLs** - Shorter for frequently changing data
4. **Monitor hit rates** - Aim for >60% hit rate

### Search Optimization

1. **Use filters before full-text search** - Category, language filters are fast
2. **Limit result size** - Don't request more than needed
3. **Use autocomplete for typeahead** - More efficient than full search
4. **Cache search results** - Especially for common queries

### Database Optimization

1. **Use connection pooling** - Already configured (20 connections)
2. **Add indexes for common queries** - Already included in schema
3. **Use pagination** - Don't fetch all results at once
4. **Monitor slow queries** - Use pg_stat_statements

### Monitoring

1. **Set up alerts** - For high latency, errors, low cache hit rate
2. **Track business metrics** - Downloads, uploads, active users
3. **Monitor resource usage** - CPU, memory, disk, network
4. **Review metrics regularly** - Identify trends and issues

## Troubleshooting

### Elasticsearch Issues

**Index not found:**
```bash
POST /api/v1/admin/reindex
```

**Connection refused:**
- Check Elasticsearch is running
- Verify ELASTICSEARCH_URL
- Check firewall rules

**Slow searches:**
- Add more Elasticsearch nodes
- Increase heap size
- Optimize queries

### Redis Issues

**Connection refused:**
- Check Redis is running
- Verify REDIS_URL
- Check network connectivity

**High memory usage:**
- Reduce TTLs
- Implement eviction policy
- Add more Redis memory

**Low hit rate:**
- Increase cache size
- Adjust TTLs
- Review caching strategy

### Performance Issues

**High latency:**
- Check cache hit rate
- Review slow database queries
- Optimize search queries
- Scale horizontally

**High error rate:**
- Check service health
- Review application logs
- Monitor resource usage

## Next Steps

- Set up production Elasticsearch cluster
- Configure Redis replication
- Deploy Prometheus and Grafana
- Create custom dashboards
- Set up alerting rules
- Implement backup strategies
