/**
 * T-Hub Component: validator
 *
 * @name validator
 * @version 1.5.0
 * @category utilities
 * @language javascript
 * @license MIT
 * @description Comprehensive data validation utility
 *
 * @exports
 * - isEmail(value) => boolean
 * - isURL(value) => boolean
 * - isPhone(value, format) => boolean
 * - isStrongPassword(value, options) => boolean
 * - sanitizeString(value) => string
 * - validateSchema(data, schema) => { valid: boolean, errors: array }
 */

/**
 * Проверяет, является ли строка валидным email
 */
function isEmail(value) {
  if (typeof value !== 'string') return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Проверяет, является ли строка валидным URL
 */
function isURL(value) {
  if (typeof value !== 'string') return false;

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Проверяет телефонный номер
 */
function isPhone(value, format = 'international') {
  if (typeof value !== 'string') return false;

  const patterns = {
    international: /^\+?[1-9]\d{1,14}$/,
    us: /^\+?1?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/,
    russia: /^\+?7[\s(]?\d{3}[\s)]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/
  };

  const pattern = patterns[format] || patterns.international;
  return pattern.test(value.replace(/\s/g, ''));
}

/**
 * Проверяет надёжность пароля
 */
function isStrongPassword(value, options = {}) {
  if (typeof value !== 'string') return false;

  const defaults = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true
  };

  const opts = { ...defaults, ...options };

  if (value.length < opts.minLength) return false;
  if (opts.requireUppercase && !/[A-Z]/.test(value)) return false;
  if (opts.requireLowercase && !/[a-z]/.test(value)) return false;
  if (opts.requireNumbers && !/\d/.test(value)) return false;
  if (opts.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)) return false;

  return true;
}

/**
 * Санитизирует строку (удаляет опасные символы)
 */
function sanitizeString(value) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * Валидирует данные по схеме
 */
function validateSchema(data, schema) {
  const errors = [];

  for (const [key, rules] of Object.entries(schema)) {
    const value = data[key];

    // Required check
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({ field: key, message: `${key} is required` });
      continue;
    }

    // Type check
    if (value !== undefined && rules.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rules.type) {
        errors.push({
          field: key,
          message: `${key} must be of type ${rules.type}, got ${actualType}`
        });
        continue;
      }
    }

    // Min/Max for numbers
    if (typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push({ field: key, message: `${key} must be at least ${rules.min}` });
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push({ field: key, message: `${key} must be at most ${rules.max}` });
      }
    }

    // MinLength/MaxLength for strings
    if (typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push({ field: key, message: `${key} must be at least ${rules.minLength} characters` });
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push({ field: key, message: `${key} must be at most ${rules.maxLength} characters` });
      }
    }

    // Pattern (regex)
    if (rules.pattern && typeof value === 'string') {
      if (!rules.pattern.test(value)) {
        errors.push({ field: key, message: `${key} has invalid format` });
      }
    }

    // Custom validator
    if (rules.validator && typeof rules.validator === 'function') {
      const result = rules.validator(value);
      if (result !== true) {
        errors.push({ field: key, message: result || `${key} is invalid` });
      }
    }

    // Enum
    if (rules.enum && Array.isArray(rules.enum)) {
      if (!rules.enum.includes(value)) {
        errors.push({
          field: key,
          message: `${key} must be one of: ${rules.enum.join(', ')}`
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  isEmail,
  isURL,
  isPhone,
  isStrongPassword,
  sanitizeString,
  validateSchema
};

// Пример использования:
/*
const { validateSchema, isEmail, isStrongPassword } = require('./validator');

// Валидация по схеме
const userSchema = {
  email: {
    required: true,
    type: 'string',
    validator: isEmail
  },
  password: {
    required: true,
    type: 'string',
    validator: (val) => isStrongPassword(val) || 'Password is too weak'
  },
  age: {
    type: 'number',
    min: 18,
    max: 120
  },
  role: {
    enum: ['user', 'admin', 'moderator']
  }
};

const userData = {
  email: 'user@example.com',
  password: 'MyP@ssw0rd',
  age: 25,
  role: 'user'
};

const result = validateSchema(userData, userSchema);
console.log(result);
// { valid: true, errors: [] }
*/
