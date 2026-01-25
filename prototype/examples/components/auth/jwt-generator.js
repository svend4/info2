/**
 * T-Hub Component: jwt-generator
 *
 * @name jwt-generator
 * @version 2.1.3
 * @category authentication
 * @language javascript
 * @license MIT
 * @description JWT token generation and validation
 *
 * @dependencies
 * - crypto (built-in)
 *
 * @exports
 * - generateToken(payload, secret, options) => string
 * - verifyToken(token, secret) => object | null
 * - refreshToken(token, secret, newExpiry) => string
 */

const crypto = require('crypto');

/**
 * Кодирует данные в Base64URL
 */
function base64UrlEncode(data) {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Декодирует данные из Base64URL
 */
function base64UrlDecode(encoded) {
  const base64 = encoded
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Создаёт подпись для JWT
 */
function createSignature(header, payload, secret) {
  const data = `${header}.${payload}`;
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Генерирует JWT токен
 *
 * @param {object} payload - Данные для токена
 * @param {string} secret - Секретный ключ
 * @param {object} options - Опции (expiresIn, issuer, audience)
 * @returns {string} JWT токен
 */
function generateToken(payload, secret, options = {}) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload must be an object');
  }

  if (!secret || typeof secret !== 'string') {
    throw new Error('Secret must be a non-empty string');
  }

  // Заголовок
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  // Payload с метаданными
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now, // Issued at
    ...(options.expiresIn && { exp: now + options.expiresIn }),
    ...(options.issuer && { iss: options.issuer }),
    ...(options.audience && { aud: options.audience })
  };

  // Кодируем части
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  // Создаём подпись
  const signature = createSignature(encodedHeader, encodedPayload, secret);

  // Собираем токен
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Проверяет и декодирует JWT токен
 *
 * @param {string} token - JWT токен
 * @param {string} secret - Секретный ключ
 * @returns {object|null} Декодированный payload или null при ошибке
 */
function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const parts = token.split('.');

    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    // Проверяем подпись
    const expectedSignature = createSignature(encodedHeader, encodedPayload, secret);

    if (signature !== expectedSignature) {
      return null; // Invalid signature
    }

    // Декодируем payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload));

    // Проверяем expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Token expired
    }

    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Обновляет токен с новым временем истечения
 *
 * @param {string} token - Существующий токен
 * @param {string} secret - Секретный ключ
 * @param {number} newExpiry - Новое время истечения (в секундах)
 * @returns {string|null} Новый токен или null
 */
function refreshToken(token, secret, newExpiry) {
  const payload = verifyToken(token, secret);

  if (!payload) {
    return null;
  }

  // Удаляем старые метаданные
  delete payload.iat;
  delete payload.exp;

  // Генерируем новый токен
  return generateToken(payload, secret, { expiresIn: newExpiry });
}

module.exports = {
  generateToken,
  verifyToken,
  refreshToken
};

// Пример использования:
/*
const { generateToken, verifyToken } = require('./jwt-generator');

// Генерация токена
const token = generateToken(
  { userId: 123, role: 'admin' },
  'my-secret-key',
  { expiresIn: 3600 } // 1 час
);

console.log('Token:', token);

// Проверка токена
const payload = verifyToken(token, 'my-secret-key');
console.log('Payload:', payload);
*/
