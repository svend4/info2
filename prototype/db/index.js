/**
 * Database Connection and Query Interface
 * Provides PostgreSQL connection pool and query methods
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

class Database {
  constructor(config) {
    this.config = config || {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'thub',
      user: process.env.DB_USER || 'thub',
      password: process.env.DB_PASSWORD || 'thub_password',
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    this.pool = new Pool(this.config);

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }

  /**
   * Execute a query
   * @param {string} text - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async query(text, params) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: result.rowCount });
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   * @returns {Promise<Object>} Database client
   */
  async getClient() {
    const client = await this.pool.connect();
    const query = client.query;
    const release = client.release;

    // Set a timeout of 5 seconds to release client
    const timeout = setTimeout(() => {
      console.error('A client has been checked out for more than 5 seconds!');
    }, 5000);

    // Monkey patch the query method to track queries
    client.query = (...args) => {
      client.lastQuery = args;
      return query.apply(client, args);
    };

    // Override release to clear timeout
    client.release = () => {
      clearTimeout(timeout);
      client.query = query;
      client.release = release;
      return release.apply(client);
    };

    return client;
  }

  /**
   * Run migrations
   * @param {string} migrationsDir - Directory containing migration files
   */
  async migrate(migrationsDir = path.join(__dirname, 'migrations')) {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');

      // Create migrations table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Get list of migration files
      const files = await fs.readdir(migrationsDir);
      const sqlFiles = files
        .filter(f => f.endsWith('.sql'))
        .sort();

      for (const file of sqlFiles) {
        // Check if migration has already been run
        const { rows } = await client.query(
          'SELECT id FROM migrations WHERE name = $1',
          [file]
        );

        if (rows.length === 0) {
          console.log(`Running migration: ${file}`);

          // Read and execute migration file
          const filePath = path.join(migrationsDir, file);
          const sql = await fs.readFile(filePath, 'utf8');
          await client.query(sql);

          // Record migration
          await client.query(
            'INSERT INTO migrations (name) VALUES ($1)',
            [file]
          );

          console.log(`✓ Migration ${file} completed`);
        } else {
          console.log(`⊘ Migration ${file} already applied`);
        }
      }

      await client.query('COMMIT');
      console.log('All migrations completed successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Migration failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Seed database with initial data
   * @param {string} seedFile - Path to seed file
   */
  async seed(seedFile) {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');

      const sql = await fs.readFile(seedFile, 'utf8');
      await client.query(sql);

      await client.query('COMMIT');
      console.log('Database seeded successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Seeding failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close all connections in the pool
   */
  async close() {
    await this.pool.end();
    console.log('Database pool closed');
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      const result = await this.query('SELECT NOW() as current_time');
      console.log('Database connection successful:', result.rows[0].current_time);
      return true;
    } catch (error) {
      console.error('Database connection failed:', error);
      return false;
    }
  }
}

// Component-specific queries
class ComponentRepository {
  constructor(db) {
    this.db = db;
  }

  async findAll({ category, language, search, limit = 10, offset = 0 }) {
    let query = `
      SELECT
        id, content_hash, name, version, description, category, language,
        license, downloads, stars, created_at, updated_at
      FROM components
      WHERE is_published = TRUE
    `;
    const params = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(category);
    }

    if (language) {
      query += ` AND language = $${paramIndex++}`;
      params.push(language);
    }

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY downloads DESC, stars DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM components WHERE is_published = TRUE';
    const countParams = [];
    let countParamIndex = 1;

    if (category) {
      countQuery += ` AND category = $${countParamIndex++}`;
      countParams.push(category);
    }

    if (language) {
      countQuery += ` AND language = $${countParamIndex++}`;
      countParams.push(language);
    }

    if (search) {
      countQuery += ` AND (name ILIKE $${countParamIndex} OR description ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await this.db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    return {
      data: result.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    };
  }

  async findById(id) {
    const result = await this.db.query(
      'SELECT * FROM component_details WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  async findByContentHash(contentHash) {
    const result = await this.db.query(
      'SELECT * FROM components WHERE content_hash = $1',
      [contentHash]
    );
    return result.rows[0];
  }

  async create(component) {
    const {
      content_hash, name, version, description, readme, category, language,
      license, repository_url, homepage_url, author_id, code_content, size_bytes
    } = component;

    const result = await this.db.query(
      `INSERT INTO components (
        content_hash, name, version, description, readme, category, language,
        license, repository_url, homepage_url, author_id, code_content, size_bytes,
        published_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
      RETURNING *`,
      [content_hash, name, version, description, readme, category, language,
       license, repository_url, homepage_url, author_id, code_content, size_bytes]
    );

    return result.rows[0];
  }

  async update(id, updates) {
    const allowedFields = ['description', 'readme', 'repository_url', 'homepage_url', 'license'];
    const setClause = [];
    const params = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = $${paramIndex++}`);
        params.push(value);
      }
    }

    if (setClause.length === 0) {
      throw new Error('No valid fields to update');
    }

    params.push(id);
    const result = await this.db.query(
      `UPDATE components SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    return result.rows[0];
  }

  async delete(id) {
    await this.db.query('DELETE FROM components WHERE id = $1', [id]);
  }

  async incrementDownloads(id, userId = null, ipAddress = null, userAgent = null) {
    const client = await this.db.getClient();
    try {
      await client.query('BEGIN');

      // Increment counter
      await client.query(
        'UPDATE components SET downloads = downloads + 1 WHERE id = $1',
        [id]
      );

      // Log download
      await client.query(
        `INSERT INTO component_downloads (component_id, user_id, ip_address, user_agent)
         VALUES ($1, $2, $3, $4)`,
        [id, userId, ipAddress, userAgent]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async search(query, limit = 10) {
    const result = await this.db.query(
      `SELECT
        id, content_hash, name, version, description, category, language,
        downloads, stars, created_at,
        similarity(name, $1) + similarity(COALESCE(description, ''), $1) as rank
      FROM components
      WHERE is_published = TRUE
        AND (name ILIKE $2 OR description ILIKE $2)
      ORDER BY rank DESC, downloads DESC
      LIMIT $3`,
      [query, `%${query}%`, limit]
    );

    return {
      query,
      results: result.rows,
      total: result.rows.length
    };
  }

  async getTrending(period = 'week', limit = 10) {
    const intervals = {
      day: '1 day',
      week: '7 days',
      month: '30 days'
    };

    const interval = intervals[period] || intervals.week;

    const result = await this.db.query(
      `SELECT
        c.id, c.name, c.version, c.description, c.category, c.stars, c.downloads,
        COUNT(cd.id) AS recent_downloads,
        c.downloads + (COUNT(cd.id) * 10) + (c.stars * 5) AS trending_score
      FROM components c
      LEFT JOIN component_downloads cd ON c.id = cd.component_id
        AND cd.downloaded_at > CURRENT_TIMESTAMP - INTERVAL '${interval}'
      WHERE c.is_published = TRUE
      GROUP BY c.id
      ORDER BY trending_score DESC
      LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  async getStats() {
    const results = await Promise.all([
      this.db.query('SELECT COUNT(*) as total FROM components WHERE is_published = TRUE'),
      this.db.query('SELECT SUM(downloads) as total FROM components WHERE is_published = TRUE'),
      this.db.query('SELECT SUM(stars) as total FROM components WHERE is_published = TRUE'),
      this.db.query('SELECT category, COUNT(*) as count FROM components WHERE is_published = TRUE GROUP BY category'),
      this.db.query('SELECT language, COUNT(*) as count FROM components WHERE is_published = TRUE GROUP BY language')
    ]);

    const categories = {};
    results[3].rows.forEach(row => {
      categories[row.category] = parseInt(row.count);
    });

    const languages = {};
    results[4].rows.forEach(row => {
      languages[row.language] = parseInt(row.count);
    });

    return {
      totalComponents: parseInt(results[0].rows[0].total),
      totalDownloads: parseInt(results[1].rows[0].total) || 0,
      totalStars: parseInt(results[2].rows[0].total) || 0,
      categories,
      languages
    };
  }

  async getDependencies(componentId) {
    const result = await this.db.query(
      `SELECT
        c.id, c.name, c.version, cd.version_constraint, cd.dependency_type
      FROM component_dependencies cd
      JOIN components c ON cd.depends_on_id = c.id
      WHERE cd.component_id = $1`,
      [componentId]
    );
    return result.rows;
  }

  async getDependents(componentId) {
    const result = await this.db.query(
      `SELECT
        c.id, c.name, c.version, cd.version_constraint
      FROM component_dependencies cd
      JOIN components c ON cd.component_id = c.id
      WHERE cd.depends_on_id = $1`,
      [componentId]
    );
    return result.rows;
  }
}

// User repository
class UserRepository {
  constructor(db) {
    this.db = db;
  }

  async findByEmail(email) {
    const result = await this.db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  async findByUsername(username) {
    const result = await this.db.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    return result.rows[0];
  }

  async findById(id) {
    const result = await this.db.query(
      'SELECT id, username, email, full_name, bio, avatar_url, is_verified, role, created_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  async create(user) {
    const { username, email, password_hash, full_name } = user;
    const result = await this.db.query(
      `INSERT INTO users (username, email, password_hash, full_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, full_name, created_at`,
      [username, email, password_hash, full_name]
    );
    return result.rows[0];
  }

  async updateLastLogin(userId) {
    await this.db.query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );
  }
}

// Export instances
let dbInstance = null;

function getDatabase(config) {
  if (!dbInstance) {
    dbInstance = new Database(config);
  }
  return dbInstance;
}

module.exports = {
  Database,
  ComponentRepository,
  UserRepository,
  getDatabase
};
