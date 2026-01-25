/**
 * Redis Cache Service for T-Hub
 * Provides caching layer for frequently accessed data
 */

const redis = require('redis');

class RedisCache {
  constructor(config) {
    this.config = config || {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            return new Error('Redis retry limit exceeded');
          }
          return retries * 100;
        }
      }
    };

    this.client = null;
    this.isConnected = false;

    // Default TTLs in seconds
    this.TTL = {
      COMPONENT: 3600,        // 1 hour
      COMPONENT_LIST: 300,    // 5 minutes
      SEARCH: 600,            // 10 minutes
      STATS: 300,             // 5 minutes
      TRENDING: 600,          // 10 minutes
      USER: 1800,             // 30 minutes
      SHORT: 60,              // 1 minute
      LONG: 86400             // 24 hours
    };
  }

  /**
   * Connect to Redis
   */
  async connect() {
    if (this.isConnected) {
      return;
    }

    try {
      this.client = redis.createClient(this.config);

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✓ Redis connected');
        this.isConnected = true;
      });

      this.client.on('reconnecting', () => {
        console.log('Redis reconnecting...');
      });

      await this.client.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value or null
   */
  async get(key) {
    if (!this.isConnected) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (value) {
        return JSON.parse(value);
      }
      return null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   */
  async set(key, value, ttl = this.TTL.SHORT) {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.client.setEx(
        key,
        ttl,
        JSON.stringify(value)
      );
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete key from cache
   * @param {string} key - Cache key
   */
  async delete(key) {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete keys matching a pattern
   * @param {string} pattern - Key pattern (e.g., "component:*")
   */
  async deletePattern(pattern) {
    if (!this.isConnected) {
      return false;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      console.error(`Cache delete pattern error for ${pattern}:`, error);
      return false;
    }
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Increment a counter
   * @param {string} key - Counter key
   * @param {number} amount - Amount to increment
   * @returns {Promise<number>} New value
   */
  async increment(key, amount = 1) {
    if (!this.isConnected) {
      return 0;
    }

    try {
      return await this.client.incrBy(key, amount);
    } catch (error) {
      console.error(`Cache increment error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   * @param {string} key - Cache key
   * @param {Function} fn - Function to compute value if not cached
   * @param {number} ttl - Time to live
   * @returns {Promise<any>}
   */
  async getOrSet(key, fn, ttl = this.TTL.SHORT) {
    const cached = await this.get(key);

    if (cached !== null) {
      return cached;
    }

    const value = await fn();
    await this.set(key, value, ttl);

    return value;
  }

  // ============================================================================
  // Domain-specific cache methods
  // ============================================================================

  /**
   * Cache a component
   * @param {string} componentId - Component ID
   * @param {object} component - Component data
   */
  async cacheComponent(componentId, component) {
    const key = `component:${componentId}`;
    return await this.set(key, component, this.TTL.COMPONENT);
  }

  /**
   * Get cached component
   * @param {string} componentId - Component ID
   */
  async getCachedComponent(componentId) {
    const key = `component:${componentId}`;
    return await this.get(key);
  }

  /**
   * Invalidate component cache
   * @param {string} componentId - Component ID
   */
  async invalidateComponent(componentId) {
    const key = `component:${componentId}`;
    await this.delete(key);
    // Also invalidate related caches
    await this.deletePattern('components:list:*');
    await this.deletePattern('search:*');
    await this.deletePattern('stats:*');
  }

  /**
   * Cache component list
   * @param {string} filters - Filter string (category, language, etc.)
   * @param {object} data - List data
   */
  async cacheComponentList(filters, data) {
    const key = `components:list:${filters}`;
    return await this.set(key, data, this.TTL.COMPONENT_LIST);
  }

  /**
   * Get cached component list
   * @param {string} filters - Filter string
   */
  async getCachedComponentList(filters) {
    const key = `components:list:${filters}`;
    return await this.get(key);
  }

  /**
   * Cache search results
   * @param {string} query - Search query
   * @param {object} results - Search results
   */
  async cacheSearch(query, results) {
    const key = `search:${query}`;
    return await this.set(key, results, this.TTL.SEARCH);
  }

  /**
   * Get cached search results
   * @param {string} query - Search query
   */
  async getCachedSearch(query) {
    const key = `search:${query}`;
    return await this.get(key);
  }

  /**
   * Cache statistics
   * @param {object} stats - Statistics data
   */
  async cacheStats(stats) {
    const key = 'stats:global';
    return await this.set(key, stats, this.TTL.STATS);
  }

  /**
   * Get cached statistics
   */
  async getCachedStats() {
    const key = 'stats:global';
    return await this.get(key);
  }

  /**
   * Cache trending components
   * @param {string} period - Time period
   * @param {Array} trending - Trending components
   */
  async cacheTrending(period, trending) {
    const key = `trending:${period}`;
    return await this.set(key, trending, this.TTL.TRENDING);
  }

  /**
   * Get cached trending components
   * @param {string} period - Time period
   */
  async getCachedTrending(period) {
    const key = `trending:${period}`;
    return await this.get(key);
  }

  /**
   * Cache user data
   * @param {string} userId - User ID
   * @param {object} user - User data
   */
  async cacheUser(userId, user) {
    const key = `user:${userId}`;
    return await this.set(key, user, this.TTL.USER);
  }

  /**
   * Get cached user
   * @param {string} userId - User ID
   */
  async getCachedUser(userId) {
    const key = `user:${userId}`;
    return await this.get(key);
  }

  /**
   * Invalidate user cache
   * @param {string} userId - User ID
   */
  async invalidateUser(userId) {
    const key = `user:${userId}`;
    await this.delete(key);
  }

  /**
   * Track rate limiting
   * @param {string} identifier - IP or user ID
   * @param {number} limit - Maximum requests
   * @param {number} window - Time window in seconds
   * @returns {Promise<object>} { allowed, remaining, resetAt }
   */
  async checkRateLimit(identifier, limit, window) {
    if (!this.isConnected) {
      return { allowed: true, remaining: limit, resetAt: null };
    }

    const key = `ratelimit:${identifier}`;

    try {
      const current = await this.increment(key, 1);

      if (current === 1) {
        // First request, set expiration
        await this.client.expire(key, window);
      }

      const ttl = await this.client.ttl(key);
      const resetAt = new Date(Date.now() + (ttl * 1000));

      return {
        allowed: current <= limit,
        remaining: Math.max(0, limit - current),
        resetAt
      };
    } catch (error) {
      console.error('Rate limit check error:', error);
      return { allowed: true, remaining: limit, resetAt: null };
    }
  }

  /**
   * Store session data
   * @param {string} sessionId - Session ID
   * @param {object} data - Session data
   * @param {number} ttl - Session TTL
   */
  async setSession(sessionId, data, ttl = 86400) {
    const key = `session:${sessionId}`;
    return await this.set(key, data, ttl);
  }

  /**
   * Get session data
   * @param {string} sessionId - Session ID
   */
  async getSession(sessionId) {
    const key = `session:${sessionId}`;
    return await this.get(key);
  }

  /**
   * Delete session
   * @param {string} sessionId - Session ID
   */
  async deleteSession(sessionId) {
    const key = `session:${sessionId}`;
    return await this.delete(key);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    if (!this.isConnected) {
      return null;
    }

    try {
      const info = await this.client.info('stats');
      const dbSize = await this.client.dbSize();

      return {
        connected: this.isConnected,
        totalKeys: dbSize,
        info: info
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return null;
    }
  }

  /**
   * Flush all cache
   */
  async flushAll() {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.client.flushAll();
      console.log('✓ Cache flushed');
      return true;
    } catch (error) {
      console.error('Failed to flush cache:', error);
      return false;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { status: 'disconnected' };
      }

      await this.client.ping();

      return {
        status: 'connected',
        isConnected: this.isConnected
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Close connection
   */
  async close() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      console.log('✓ Redis disconnected');
    }
  }
}

// Export singleton instance
let cacheInstance = null;

function getCache(config) {
  if (!cacheInstance) {
    cacheInstance = new RedisCache(config);
  }
  return cacheInstance;
}

module.exports = {
  RedisCache,
  getCache
};
