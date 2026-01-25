/**
 * Integration Tests for T-Hub API
 * Tests API endpoints with real database
 */

const request = require('supertest');
const app = require('../api/server');
const { getDatabase } = require('../db');

describe('T-Hub API Integration Tests', () => {
  let db;
  let authToken;
  let userId;

  beforeAll(async () => {
    // Connect to test database
    db = getDatabase({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'thub_test',
      user: process.env.DB_USER || 'thub',
      password: process.env.DB_PASSWORD || 'thub_password'
    });

    // Run migrations
    await db.migrate();
  });

  afterAll(async () => {
    // Clean up
    await db.close();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBeDefined();
      expect(response.body.database).toBe('connected');
    });
  });

  describe('Authentication', () => {
    const testUser = {
      username: 'testuser_' + Date.now(),
      email: `test${Date.now()}@example.com`,
      password: 'TestPassword123',
      full_name: 'Test User'
    };

    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body.user).toBeDefined();
      expect(response.body.token).toBeDefined();
      expect(response.body.user.username).toBe(testUser.username);

      authToken = response.body.token;
      userId = response.body.user.id;
    });

    it('should reject duplicate email registration', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(409);

      expect(response.body.error).toBe('User already exists');
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe(testUser.email);
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'wrong_password'
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should get current user with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.user.id).toBe(userId);
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('Components', () => {
    let componentId;

    it('should create a new component', async () => {
      const component = {
        name: 'test-component',
        version: '1.0.0',
        description: 'A test component',
        category: 'Utilities',
        language: 'JavaScript',
        code: 'module.exports = function test() { return "Hello"; };'
      };

      const response = await request(app)
        .post('/api/v1/components')
        .set('Authorization', `Bearer ${authToken}`)
        .send(component)
        .expect(201);

      expect(response.body.component).toBeDefined();
      expect(response.body.component.name).toBe(component.name);

      componentId = response.body.component.id;
    });

    it('should list components', async () => {
      const response = await request(app)
        .get('/api/v1/components')
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it('should get component by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/components/${componentId}`)
        .expect(200);

      expect(response.body.id).toBe(componentId);
      expect(response.body.name).toBe('test-component');
    });

    it('should search components', async () => {
      const response = await request(app)
        .get('/api/v1/search?q=test')
        .expect(200);

      expect(response.body.results).toBeDefined();
      expect(Array.isArray(response.body.results)).toBe(true);
    });

    it('should get statistics', async () => {
      const response = await request(app)
        .get('/api/v1/stats')
        .expect(200);

      expect(response.body.totalComponents).toBeDefined();
      expect(response.body.categories).toBeDefined();
      expect(response.body.languages).toBeDefined();
    });

    it('should get trending components', async () => {
      const response = await request(app)
        .get('/api/v1/trending?period=week')
        .expect(200);

      expect(response.body.trending).toBeDefined();
      expect(Array.isArray(response.body.trending)).toBe(true);
    });

    it('should update component', async () => {
      const updates = {
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/v1/components/${componentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.component.description).toBe(updates.description);
    });

    it('should download component', async () => {
      const response = await request(app)
        .get(`/api/v1/components/${componentId}/download`)
        .expect(200);

      expect(response.headers['content-type']).toBe('application/javascript');
      expect(response.text).toContain('module.exports');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent component', async () => {
      const response = await request(app)
        .get('/api/v1/components/00000000-0000-0000-0000-000000000000')
        .expect(404);

      expect(response.body.error).toBe('Component not found');
    });

    it('should return 404 for non-existent endpoint', async () => {
      const response = await request(app)
        .get('/api/v1/nonexistent')
        .expect(404);

      expect(response.body.error).toBe('Endpoint not found');
    });

    it('should reject component creation without auth', async () => {
      const response = await request(app)
        .post('/api/v1/components')
        .send({
          name: 'test',
          version: '1.0.0',
          code: 'test'
        })
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
    });
  });
});
