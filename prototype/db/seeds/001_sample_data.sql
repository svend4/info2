-- Seed Database with Sample Data
-- This creates example components for testing and demonstration

-- Create sample users
INSERT INTO users (id, username, email, password_hash, full_name, is_verified, role)
VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'john_doe', 'john@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'John Doe', TRUE, 'user'),
  ('550e8400-e29b-41d4-a716-446655440002', 'jane_smith', 'jane@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'Jane Smith', TRUE, 'user'),
  ('550e8400-e29b-41d4-a716-446655440003', 'bob_jones', 'bob@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'Bob Jones', TRUE, 'moderator')
ON CONFLICT (id) DO NOTHING;

-- Create categories/tags
INSERT INTO tags (name, description)
VALUES
  ('authentication', 'Authentication and authorization utilities'),
  ('jwt', 'JSON Web Token utilities'),
  ('validation', 'Data validation libraries'),
  ('database', 'Database query builders and ORMs'),
  ('api', 'API utilities and helpers'),
  ('security', 'Security and encryption tools'),
  ('utilities', 'General purpose utilities')
ON CONFLICT (name) DO NOTHING;

-- Insert jwt-generator component
INSERT INTO components (
  id, content_hash, name, version, description, readme, category, language, license,
  author_id, code_content, size_bytes, downloads, stars, is_published, is_verified
)
VALUES (
  '650e8400-e29b-41d4-a716-446655440001',
  'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890',
  'jwt-generator',
  '2.1.3',
  'Lightweight JWT token generator and validator with no external dependencies',
  '# JWT Generator\n\nA simple, zero-dependency JWT implementation for Node.js.\n\n## Features\n- Generate JWT tokens\n- Verify JWT tokens\n- Refresh tokens\n- HMAC SHA-256 signing\n\n## Usage\n```javascript\nconst { generateToken, verifyToken } = require(''jwt-generator'');\n\nconst token = generateToken({ userId: 123 }, ''secret'', { expiresIn: 3600 });\nconst payload = verifyToken(token, ''secret'');\n```',
  'Authentication',
  'JavaScript',
  'MIT',
  '550e8400-e29b-41d4-a716-446655440001',
  'function generateToken(payload, secret, options = {}) { /* ... */ }',
  4096,
  15234,
  342,
  TRUE,
  TRUE
),
(
  '650e8400-e29b-41d4-a716-446655440002',
  'b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890a1',
  'validator',
  '1.5.0',
  'Comprehensive data validation library with schema support',
  '# Validator\n\nComprehensive validation library for JavaScript.\n\n## Features\n- Email validation\n- URL validation\n- Phone number validation\n- Password strength checking\n- Schema validation\n- Data sanitization',
  'Utilities',
  'JavaScript',
  'MIT',
  '550e8400-e29b-41d4-a716-446655440002',
  'function isEmail(value) { /* ... */ }',
  5120,
  23456,
  567,
  TRUE,
  TRUE
),
(
  '650e8400-e29b-41d4-a716-446655440003',
  'c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890a1b2',
  'query-builder',
  '3.2.1',
  'Fluent SQL query builder supporting PostgreSQL, MySQL, and SQLite',
  '# Query Builder\n\nFluent interface for building SQL queries.\n\n## Supported Databases\n- PostgreSQL\n- MySQL\n- SQLite\n\n## Usage\n```javascript\nconst QueryBuilder = require(''query-builder'');\n\nconst qb = new QueryBuilder(''postgresql'');\nconst { sql, bindings } = qb\n  .select(''id'', ''name'', ''email'')\n  .from(''users'')\n  .where(''active'', ''='', true)\n  .orderBy(''created_at'', ''DESC'')\n  .limit(10)\n  .toSQL();\n```',
  'Data',
  'JavaScript',
  'MIT',
  '550e8400-e29b-41d4-a716-446655440001',
  'class QueryBuilder { /* ... */ }',
  8192,
  18765,
  423,
  TRUE,
  TRUE
),
(
  '650e8400-e29b-41d4-a716-446655440004',
  'd4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890a1b2c3',
  'rate-limiter',
  '2.0.5',
  'Flexible rate limiting middleware with multiple algorithms',
  '# Rate Limiter\n\nFlexible rate limiting for APIs.\n\n## Algorithms\n- Fixed Window\n- Sliding Window\n- Token Bucket\n- Leaky Bucket\n\n## Usage\n```javascript\nconst { RateLimiter } = require(''rate-limiter'');\n\nconst limiter = new RateLimiter({\n  algorithm: ''token-bucket'',\n  capacity: 100,\n  refillRate: 10\n});\n\napp.use(limiter.middleware());\n```',
  'API',
  'JavaScript',
  'MIT',
  '550e8400-e29b-41d4-a716-446655440003',
  'class RateLimiter { /* ... */ }',
  6144,
  12345,
  289,
  TRUE,
  TRUE
),
(
  '650e8400-e29b-41d4-a716-446655440005',
  'e5f67890abcdef1234567890abcdef1234567890abcdef1234567890a1b2c3d4',
  'crypto-utils',
  '1.2.0',
  'Cryptographic utilities for hashing, encryption, and random generation',
  '# Crypto Utils\n\nCryptographic utilities for common tasks.\n\n## Features\n- SHA-256 hashing\n- bcrypt password hashing\n- AES encryption/decryption\n- Random string generation\n- UUID generation',
  'Security',
  'JavaScript',
  'MIT',
  '550e8400-e29b-41d4-a716-446655440002',
  'const crypto = require(''crypto''); /* ... */',
  3072,
  9876,
  234,
  TRUE,
  TRUE
);

-- Add component exports
INSERT INTO component_exports (component_id, name, type, signature, description, is_default)
VALUES
  ('650e8400-e29b-41d4-a716-446655440001', 'generateToken', 'function', '(payload: object, secret: string, options?: object): string', 'Generate a JWT token', FALSE),
  ('650e8400-e29b-41d4-a716-446655440001', 'verifyToken', 'function', '(token: string, secret: string): object | null', 'Verify and decode a JWT token', FALSE),
  ('650e8400-e29b-41d4-a716-446655440001', 'refreshToken', 'function', '(token: string, secret: string, newExpiry: number): string', 'Refresh an existing token', FALSE),
  ('650e8400-e29b-41d4-a716-446655440002', 'isEmail', 'function', '(value: string): boolean', 'Validate email address', FALSE),
  ('650e8400-e29b-41d4-a716-446655440002', 'isURL', 'function', '(value: string): boolean', 'Validate URL', FALSE),
  ('650e8400-e29b-41d4-a716-446655440002', 'validateSchema', 'function', '(data: object, schema: object): {valid: boolean, errors: array}', 'Validate against schema', FALSE),
  ('650e8400-e29b-41d4-a716-446655440003', 'QueryBuilder', 'class', 'class QueryBuilder', 'SQL query builder', TRUE),
  ('650e8400-e29b-41d4-a716-446655440004', 'RateLimiter', 'class', 'class RateLimiter', 'Rate limiting class', TRUE);

-- Link components to tags
INSERT INTO component_tags (component_id, tag_id)
SELECT c.id, t.id
FROM components c
CROSS JOIN tags t
WHERE (c.name = 'jwt-generator' AND t.name IN ('authentication', 'jwt', 'security'))
   OR (c.name = 'validator' AND t.name IN ('validation', 'utilities'))
   OR (c.name = 'query-builder' AND t.name IN ('database', 'utilities'))
   OR (c.name = 'rate-limiter' AND t.name IN ('api', 'security'))
   OR (c.name = 'crypto-utils' AND t.name IN ('security', 'utilities'));

-- Add component dependencies
-- jwt-generator has no dependencies
-- validator has no dependencies
-- query-builder has no dependencies
-- rate-limiter has no dependencies
-- crypto-utils has no dependencies

-- Add quality metrics
INSERT INTO component_quality (
  component_id, test_coverage, security_score, maintainability_index,
  complexity_score, documentation_score, has_tests, has_readme, has_license,
  lines_of_code, comment_ratio
)
VALUES
  ('650e8400-e29b-41d4-a716-446655440001', 95.5, 98, 85.2, 12.3, 92, TRUE, TRUE, TRUE, 156, 18.5),
  ('650e8400-e29b-41d4-a716-446655440002', 88.3, 95, 82.1, 15.7, 88, TRUE, TRUE, TRUE, 234, 15.2),
  ('650e8400-e29b-41d4-a716-446655440003', 92.1, 96, 88.4, 18.2, 90, TRUE, TRUE, TRUE, 312, 22.1),
  ('650e8400-e29b-41d4-a716-446655440004', 85.7, 94, 79.3, 14.5, 85, TRUE, TRUE, TRUE, 198, 16.8),
  ('650e8400-e29b-41d4-a716-446655440005', 91.2, 99, 86.7, 11.8, 89, TRUE, TRUE, TRUE, 142, 19.3);

-- Add some component stars
INSERT INTO component_stars (user_id, component_id)
VALUES
  ('550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440002'),
  ('550e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440003'),
  ('550e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440001'),
  ('550e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440003'),
  ('550e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440001');

-- Add some download records (recent activity)
INSERT INTO component_downloads (component_id, user_id, ip_address, user_agent)
VALUES
  ('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '192.168.1.100', 'Mozilla/5.0'),
  ('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', '192.168.1.101', 'Mozilla/5.0'),
  ('650e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', '192.168.1.100', 'Mozilla/5.0'),
  ('650e8400-e29b-41d4-a716-446655440001', NULL, '10.0.0.50', 'curl/7.68.0'),
  ('650e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440003', '192.168.1.102', 'Mozilla/5.0');
