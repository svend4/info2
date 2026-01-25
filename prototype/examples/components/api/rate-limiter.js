/**
 * T-Hub Component: rate-limiter
 *
 * @name rate-limiter
 * @version 2.0.5
 * @category api
 * @language javascript
 * @license MIT
 * @description Rate limiting middleware with multiple algorithms
 *
 * @exports
 * - RateLimiter class
 * - algorithms: fixedWindow, slidingWindow, tokenBucket, leakyBucket
 */

class RateLimiter {
  constructor(options = {}) {
    this.options = {
      windowMs: options.windowMs || 60 * 1000, // 1 minute
      max: options.max || 100, // 100 requests per window
      algorithm: options.algorithm || 'fixedWindow',
      keyGenerator: options.keyGenerator || this.defaultKeyGenerator,
      handler: options.handler || this.defaultHandler,
      skip: options.skip || (() => false),
      store: options.store || new MemoryStore()
    };
  }

  /**
   * Генератор ключа по умолчанию (по IP)
   */
  defaultKeyGenerator(req) {
    return req.ip || req.connection.remoteAddress;
  }

  /**
   * Обработчик превышения лимита по умолчанию
   */
  defaultHandler(req, res) {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please try again later',
      retryAfter: Math.ceil(this.options.windowMs / 1000)
    });
  }

  /**
   * Middleware для Express/Fastify
   */
  middleware() {
    return async (req, res, next) => {
      // Пропускаем, если задано условие skip
      if (this.options.skip(req)) {
        return next();
      }

      const key = this.options.keyGenerator(req);

      try {
        const result = await this.checkLimit(key);

        // Устанавливаем заголовки
        res.setHeader('X-RateLimit-Limit', this.options.max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, this.options.max - result.count));
        res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

        if (result.allowed) {
          next();
        } else {
          res.setHeader('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000));
          this.options.handler(req, res);
        }
      } catch (error) {
        console.error('Rate limiter error:', error);
        next(); // Fail open
      }
    };
  }

  /**
   * Проверка лимита
   */
  async checkLimit(key) {
    switch (this.options.algorithm) {
      case 'fixedWindow':
        return this.fixedWindow(key);

      case 'slidingWindow':
        return this.slidingWindow(key);

      case 'tokenBucket':
        return this.tokenBucket(key);

      case 'leakyBucket':
        return this.leakyBucket(key);

      default:
        return this.fixedWindow(key);
    }
  }

  /**
   * Fixed Window алгоритм
   */
  async fixedWindow(key) {
    const now = Date.now();
    const windowStart = Math.floor(now / this.options.windowMs) * this.options.windowMs;
    const resetTime = windowStart + this.options.windowMs;

    const storeKey = `${key}:${windowStart}`;
    const count = await this.options.store.increment(storeKey);

    // Устанавливаем TTL для автоматической очистки
    if (count === 1) {
      await this.options.store.expire(storeKey, Math.ceil(this.options.windowMs / 1000));
    }

    return {
      allowed: count <= this.options.max,
      count,
      resetTime
    };
  }

  /**
   * Sliding Window алгоритм
   */
  async slidingWindow(key) {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;

    const timestamps = await this.options.store.getList(key) || [];

    // Фильтруем старые записи
    const validTimestamps = timestamps.filter(ts => ts > windowStart);

    // Добавляем текущий запрос
    validTimestamps.push(now);

    await this.options.store.setList(key, validTimestamps);
    await this.options.store.expire(key, Math.ceil(this.options.windowMs / 1000));

    return {
      allowed: validTimestamps.length <= this.options.max,
      count: validTimestamps.length,
      resetTime: Math.min(...validTimestamps) + this.options.windowMs
    };
  }

  /**
   * Token Bucket алгоритм
   */
  async tokenBucket(key) {
    const now = Date.now();
    const refillRate = this.options.max / this.options.windowMs; // tokens per ms

    let bucket = await this.options.store.get(key);

    if (!bucket) {
      bucket = {
        tokens: this.options.max,
        lastRefill: now
      };
    } else {
      // Пополняем токены
      const timePassed = now - bucket.lastRefill;
      const tokensToAdd = timePassed * refillRate;
      bucket.tokens = Math.min(this.options.max, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    // Пытаемся взять токен
    const allowed = bucket.tokens >= 1;

    if (allowed) {
      bucket.tokens -= 1;
    }

    await this.options.store.set(key, bucket);
    await this.options.store.expire(key, Math.ceil(this.options.windowMs / 1000));

    return {
      allowed,
      count: Math.ceil(this.options.max - bucket.tokens),
      resetTime: now + ((this.options.max - bucket.tokens) / refillRate)
    };
  }

  /**
   * Leaky Bucket алгоритм
   */
  async leakyBucket(key) {
    const now = Date.now();
    const leakRate = this.options.max / this.options.windowMs; // requests per ms

    let bucket = await this.options.store.get(key);

    if (!bucket) {
      bucket = {
        count: 0,
        lastLeak: now
      };
    } else {
      // Утечка
      const timePassed = now - bucket.lastLeak;
      const leaked = timePassed * leakRate;
      bucket.count = Math.max(0, bucket.count - leaked);
      bucket.lastLeak = now;
    }

    // Добавляем запрос
    bucket.count += 1;

    const allowed = bucket.count <= this.options.max;

    await this.options.store.set(key, bucket);
    await this.options.store.expire(key, Math.ceil(this.options.windowMs / 1000));

    return {
      allowed,
      count: Math.ceil(bucket.count),
      resetTime: now + ((bucket.count - this.options.max) / leakRate)
    };
  }
}

/**
 * In-memory storage
 */
class MemoryStore {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    return this.store.get(key);
  }

  async set(key, value) {
    this.store.set(key, value);
  }

  async increment(key) {
    const current = this.store.get(key) || 0;
    const newValue = current + 1;
    this.store.set(key, newValue);
    return newValue;
  }

  async getList(key) {
    return this.store.get(key);
  }

  async setList(key, list) {
    this.store.set(key, list);
  }

  async expire(key, seconds) {
    setTimeout(() => {
      this.store.delete(key);
    }, seconds * 1000);
  }

  async clear() {
    this.store.clear();
  }
}

module.exports = { RateLimiter, MemoryStore };

// Пример использования:
/*
const express = require('express');
const { RateLimiter } = require('./rate-limiter');

const app = express();

// Создаём rate limiter
const limiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 минута
  max: 100, // максимум 100 запросов
  algorithm: 'slidingWindow'
});

// Применяем ко всем роутам
app.use(limiter.middleware());

// Или к конкретному роуту
app.get('/api/data', limiter.middleware(), (req, res) => {
  res.json({ data: 'some data' });
});

// Кастомный key generator (например, по user ID)
const userLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  max: 50,
  keyGenerator: (req) => req.user?.id || req.ip
});

app.listen(3000);
*/
