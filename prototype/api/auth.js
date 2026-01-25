/**
 * Authentication and Authorization Module
 * Handles user registration, login, JWT tokens, and auth middleware
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches
 */
async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 * @param {object} payload - Token payload (user info)
 * @param {string} expiresIn - Expiration time
 * @returns {string} JWT token
 */
function generateToken(payload, expiresIn = JWT_EXPIRES_IN) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Verify and decode JWT token
 * @param {string} token - JWT token
 * @returns {object|null} Decoded payload or null if invalid
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Generate API key
 * @returns {object} { key, hash }
 */
function generateApiKey() {
  const key = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return { key, hash };
}

/**
 * Express middleware to authenticate requests
 * Checks for Authorization header with Bearer token or API key
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please provide an Authorization header with a valid token'
    });
  }

  // Bearer token authentication
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'The provided token is invalid or expired'
      });
    }

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role
    };

    return next();
  }

  // API key authentication
  if (authHeader.startsWith('ApiKey ')) {
    const apiKey = authHeader.substring(7);
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // In a real implementation, we'd check this against the database
    // For now, we'll just validate the format
    if (!apiKey || apiKey.length !== 64) {
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is invalid'
      });
    }

    // Store the API key hash for database lookup (would happen in middleware)
    req.apiKeyHash = keyHash;
    req.user = { id: null, role: 'api_user' }; // Placeholder

    return next();
  }

  return res.status(401).json({
    error: 'Invalid authorization header',
    message: 'Authorization header must start with "Bearer " or "ApiKey "'
  });
}

/**
 * Express middleware to check for optional authentication
 * Similar to authenticate() but doesn't require auth
 */
function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    // No auth provided, continue without user
    req.user = null;
    return next();
  }

  // Try to authenticate, but don't fail if it doesn't work
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (decoded) {
      req.user = {
        id: decoded.userId,
        username: decoded.username,
        email: decoded.email,
        role: decoded.role
      };
    } else {
      req.user = null;
    }
  }

  next();
}

/**
 * Express middleware to check user role
 * @param {...string} allowedRoles - Roles that are allowed to access
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource'
      });
    }

    next();
  };
}

/**
 * Validate registration input
 * @param {object} data - Registration data
 * @returns {object} { valid: boolean, errors: array }
 */
function validateRegistration(data) {
  const errors = [];

  if (!data.username || data.username.length < 3 || data.username.length > 50) {
    errors.push('Username must be between 3 and 50 characters');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(data.username)) {
    errors.push('Username can only contain letters, numbers, underscores, and hyphens');
  }

  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Valid email is required');
  }

  if (!data.password || data.password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Password strength check
  if (data.password) {
    const hasUpperCase = /[A-Z]/.test(data.password);
    const hasLowerCase = /[a-z]/.test(data.password);
    const hasNumbers = /\d/.test(data.password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      errors.push('Password must contain uppercase, lowercase, and numbers');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Rate limiting for authentication endpoints
 * Simple in-memory rate limiter (use Redis in production)
 */
class RateLimiter {
  constructor(windowMs = 15 * 60 * 1000, maxAttempts = 5) {
    this.windowMs = windowMs;
    this.maxAttempts = maxAttempts;
    this.attempts = new Map();
  }

  check(identifier) {
    const now = Date.now();
    const userAttempts = this.attempts.get(identifier) || [];

    // Clean old attempts outside the window
    const recentAttempts = userAttempts.filter(
      timestamp => now - timestamp < this.windowMs
    );

    if (recentAttempts.length >= this.maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(recentAttempts[0] + this.windowMs)
      };
    }

    recentAttempts.push(now);
    this.attempts.set(identifier, recentAttempts);

    return {
      allowed: true,
      remaining: this.maxAttempts - recentAttempts.length,
      resetAt: new Date(now + this.windowMs)
    };
  }

  reset(identifier) {
    this.attempts.delete(identifier);
  }
}

const authRateLimiter = new RateLimiter(15 * 60 * 1000, 5); // 5 attempts per 15 minutes

/**
 * Middleware for rate limiting authentication endpoints
 */
function authRateLimit(req, res, next) {
  const identifier = req.ip || req.connection.remoteAddress;
  const result = authRateLimiter.check(identifier);

  res.setHeader('X-RateLimit-Limit', 5);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', result.resetAt.toISOString());

  if (!result.allowed) {
    return res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Please try again later',
      resetAt: result.resetAt.toISOString()
    });
  }

  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  generateApiKey,
  authenticate,
  optionalAuthenticate,
  authorize,
  validateRegistration,
  authRateLimit,
  authRateLimiter
};
