# Database Setup Guide

This guide explains how to set up the PostgreSQL database for T-Hub.

## Prerequisites

- PostgreSQL 15+ installed
- Node.js 18+ installed

## Quick Setup (Docker)

The easiest way to get started is using Docker Compose:

```bash
# From the project root
docker-compose up -d postgres redis

# The database will be available at localhost:5432
```

## Manual Setup

### 1. Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Windows:**
Download and install from https://www.postgresql.org/download/windows/

### 2. Create Database and User

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# In psql shell:
CREATE DATABASE thub;
CREATE USER thub WITH PASSWORD 'thub_password';
GRANT ALL PRIVILEGES ON DATABASE thub TO thub;

# Enable required extensions
\c thub
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

# Exit psql
\q
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and set your database credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=thub
DB_USER=thub
DB_PASSWORD=thub_password
```

### 4. Run Migrations

Install dependencies first:

```bash
npm install
```

Run database migrations:

```bash
npm run db:migrate
```

This will create all necessary tables, indexes, triggers, and views.

### 5. Seed Database (Optional)

To populate the database with sample data:

```bash
npm run db:seed
```

This will create:
- 3 sample users
- 5 example components (jwt-generator, validator, query-builder, rate-limiter, crypto-utils)
- Component metadata (tags, exports, quality metrics)
- Sample download records

### 6. Verify Setup

Test the database connection:

```bash
node -e "require('./db').getDatabase().testConnection().then(() => console.log('✓ Database connected'))"
```

## Database Schema

The database includes the following main tables:

### Core Tables
- `users` - User accounts
- `components` - Software components
- `component_dependencies` - Dependency relationships
- `component_exports` - Exported functions/classes
- `component_quality` - Quality metrics

### Metadata Tables
- `tags` - Component tags
- `component_tags` - Component-tag relationships
- `component_stars` - User favorites
- `component_downloads` - Download analytics
- `duplicate_cache` - Duplicate detection results

### Security Tables
- `api_keys` - API key authentication
- `audit_log` - Audit trail

### System Tables
- `migrations` - Migration history

## Migrations

Migrations are stored in `db/migrations/` and are run automatically when the server starts (unless `RUN_MIGRATIONS=false`).

To run migrations manually:

```bash
npm run db:migrate
```

Migrations are tracked in the `migrations` table to prevent duplicate execution.

## Database Maintenance

### Backup

```bash
pg_dump -U thub -d thub > backup.sql
```

### Restore

```bash
psql -U thub -d thub < backup.sql
```

### Reset Database

**⚠️ WARNING: This will delete all data!**

```bash
# Drop and recreate database
sudo -u postgres psql -c "DROP DATABASE thub;"
sudo -u postgres psql -c "CREATE DATABASE thub;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE thub TO thub;"

# Recreate extensions
psql -U thub -d thub -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
psql -U thub -d thub -c "CREATE EXTENSION IF NOT EXISTS \"pg_trgm\";"

# Run migrations and seed
npm run db:migrate
npm run db:seed
```

## Performance Tuning

### Indexes

The schema includes indexes on:
- All foreign keys
- Frequently queried columns (name, category, language, content_hash)
- Full-text search columns using `pg_trgm`
- Download/star counts for trending queries

### Connection Pooling

The database module uses `pg.Pool` with these defaults:
- Max connections: 20
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

Adjust these in `db/index.js` if needed.

### Query Optimization

For large datasets, consider:

1. **Partitioning downloads table** by month:
```sql
ALTER TABLE component_downloads PARTITION BY RANGE (downloaded_at);
```

2. **Materialized views** for trending components:
```sql
CREATE MATERIALIZED VIEW trending_cache AS
SELECT * FROM trending_components;

CREATE UNIQUE INDEX ON trending_cache (id);
```

3. **Regular VACUUM ANALYZE**:
```bash
psql -U thub -d thub -c "VACUUM ANALYZE;"
```

## Troubleshooting

### Connection Refused

Check if PostgreSQL is running:
```bash
sudo systemctl status postgresql  # Linux
brew services list                 # macOS
```

### Permission Denied

Ensure the user has proper permissions:
```sql
GRANT ALL PRIVILEGES ON DATABASE thub TO thub;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO thub;
```

### Extension Missing

Install required extensions:
```bash
sudo apt install postgresql-contrib  # Ubuntu/Debian
```

### Migration Errors

If migrations fail, check the `migrations` table:
```sql
SELECT * FROM migrations;
```

To retry a failed migration, delete its entry and run again:
```sql
DELETE FROM migrations WHERE name = '001_initial_schema.sql';
```

## Testing

The integration tests use a separate test database:

```bash
# Create test database
sudo -u postgres psql -c "CREATE DATABASE thub_test;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE thub_test TO thub;"

# Run tests
npm run test:integration
```

Set `DB_NAME=thub_test` in your test environment to use the test database.

## Production Considerations

For production deployment:

1. **Use SSL connections**:
```env
DATABASE_URL=postgres://user:pass@host:5432/db?sslmode=require
```

2. **Set up replication** for high availability

3. **Configure automated backups**:
```bash
# Add to cron
0 2 * * * pg_dump -U thub thub | gzip > /backups/thub_$(date +\%Y\%m\%d).sql.gz
```

4. **Monitor slow queries**:
```sql
CREATE EXTENSION pg_stat_statements;
```

5. **Use connection pooling** (PgBouncer or pgpool-II)

6. **Tune PostgreSQL settings** in `postgresql.conf`:
```
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 16MB
maintenance_work_mem = 128MB
```

## Further Reading

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [pg module documentation](https://node-postgres.com/)
- [Database Design Best Practices](https://www.postgresql.org/docs/current/ddl.html)
