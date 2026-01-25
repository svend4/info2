-- T-Hub Database Schema
-- Migration 001: Initial Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- ============================================================================
-- Users Table
-- ============================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  bio TEXT,
  avatar_url VARCHAR(512),
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- ============================================================================
-- Components Table
-- ============================================================================
CREATE TABLE components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 hash
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  description TEXT,
  readme TEXT,
  category VARCHAR(100) NOT NULL,
  language VARCHAR(50) NOT NULL,
  license VARCHAR(100) DEFAULT 'MIT',
  repository_url VARCHAR(512),
  homepage_url VARCHAR(512),
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  size_bytes INTEGER,
  code_content TEXT NOT NULL,
  downloads INTEGER DEFAULT 0,
  stars INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(name, version)
);

CREATE INDEX idx_components_name ON components(name);
CREATE INDEX idx_components_category ON components(category);
CREATE INDEX idx_components_language ON components(language);
CREATE INDEX idx_components_content_hash ON components(content_hash);
CREATE INDEX idx_components_author_id ON components(author_id);
CREATE INDEX idx_components_downloads ON components(downloads DESC);
CREATE INDEX idx_components_stars ON components(stars DESC);
CREATE INDEX idx_components_created_at ON components(created_at DESC);
CREATE INDEX idx_components_name_trgm ON components USING gin(name gin_trgm_ops);
CREATE INDEX idx_components_description_trgm ON components USING gin(description gin_trgm_ops);

-- ============================================================================
-- Component Dependencies
-- ============================================================================
CREATE TABLE component_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  depends_on_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  version_constraint VARCHAR(100),
  dependency_type VARCHAR(50) DEFAULT 'runtime' CHECK (
    dependency_type IN ('runtime', 'dev', 'peer', 'optional')
  ),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(component_id, depends_on_id)
);

CREATE INDEX idx_dependencies_component_id ON component_dependencies(component_id);
CREATE INDEX idx_dependencies_depends_on_id ON component_dependencies(depends_on_id);

-- ============================================================================
-- Component Exports (Functions, Classes, etc.)
-- ============================================================================
CREATE TABLE component_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (
    type IN ('function', 'class', 'constant', 'type', 'interface')
  ),
  signature TEXT,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exports_component_id ON component_exports(component_id);
CREATE INDEX idx_exports_name ON component_exports(name);

-- ============================================================================
-- Component Tags
-- ============================================================================
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tags_name ON tags(name);
CREATE INDEX idx_tags_usage_count ON tags(usage_count DESC);

CREATE TABLE component_tags (
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (component_id, tag_id)
);

CREATE INDEX idx_component_tags_component_id ON component_tags(component_id);
CREATE INDEX idx_component_tags_tag_id ON component_tags(tag_id);

-- ============================================================================
-- Component Stars (User favorites)
-- ============================================================================
CREATE TABLE component_stars (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, component_id)
);

CREATE INDEX idx_stars_user_id ON component_stars(user_id);
CREATE INDEX idx_stars_component_id ON component_stars(component_id);

-- ============================================================================
-- Component Downloads (Analytics)
-- ============================================================================
CREATE TABLE component_downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_downloads_component_id ON component_downloads(component_id);
CREATE INDEX idx_downloads_downloaded_at ON component_downloads(downloaded_at DESC);

-- Partitioning by month for downloads (optional, for scaling)
-- ALTER TABLE component_downloads PARTITION BY RANGE (downloaded_at);

-- ============================================================================
-- Duplicate Detection Cache
-- ============================================================================
CREATE TABLE duplicate_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  similar_component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  similarity_score DECIMAL(5,4) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
  similarity_type VARCHAR(50) NOT NULL CHECK (
    similarity_type IN ('exact', 'normalized', 'semantic')
  ),
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(component_id, similar_component_id)
);

CREATE INDEX idx_duplicate_cache_component_id ON duplicate_cache(component_id);
CREATE INDEX idx_duplicate_cache_similarity_score ON duplicate_cache(similarity_score DESC);

-- ============================================================================
-- Quality Metrics
-- ============================================================================
CREATE TABLE component_quality (
  component_id UUID PRIMARY KEY REFERENCES components(id) ON DELETE CASCADE,
  test_coverage DECIMAL(5,2) CHECK (test_coverage >= 0 AND test_coverage <= 100),
  security_score INTEGER CHECK (security_score >= 0 AND security_score <= 100),
  maintainability_index DECIMAL(5,2),
  complexity_score DECIMAL(5,2),
  documentation_score INTEGER CHECK (documentation_score >= 0 AND documentation_score <= 100),
  has_tests BOOLEAN DEFAULT FALSE,
  has_readme BOOLEAN DEFAULT FALSE,
  has_license BOOLEAN DEFAULT FALSE,
  lines_of_code INTEGER,
  comment_ratio DECIMAL(5,2),
  last_analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- API Keys for Authentication
-- ============================================================================
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);

-- ============================================================================
-- Audit Log
-- ============================================================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action);

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_components_updated_at BEFORE UPDATE ON components
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_component_quality_updated_at BEFORE UPDATE ON component_quality
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update component star count
CREATE OR REPLACE FUNCTION update_component_star_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE components SET stars = stars + 1 WHERE id = NEW.component_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE components SET stars = stars - 1 WHERE id = OLD.component_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_star_count
AFTER INSERT OR DELETE ON component_stars
FOR EACH ROW EXECUTE FUNCTION update_component_star_count();

-- Update tag usage count
CREATE OR REPLACE FUNCTION update_tag_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tags SET usage_count = usage_count - 1 WHERE id = OLD.tag_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tag_usage
AFTER INSERT OR DELETE ON component_tags
FOR EACH ROW EXECUTE FUNCTION update_tag_usage_count();

-- ============================================================================
-- Views
-- ============================================================================

-- Component with full details view
CREATE OR REPLACE VIEW component_details AS
SELECT
  c.*,
  u.username AS author_username,
  u.full_name AS author_name,
  q.test_coverage,
  q.security_score,
  q.maintainability_index,
  q.documentation_score,
  (
    SELECT json_agg(json_build_object(
      'id', d.id,
      'name', dc.name,
      'version', dc.version,
      'version_constraint', d.version_constraint
    ))
    FROM component_dependencies d
    JOIN components dc ON d.depends_on_id = dc.id
    WHERE d.component_id = c.id
  ) AS dependencies,
  (
    SELECT json_agg(json_build_object(
      'name', e.name,
      'type', e.type,
      'signature', e.signature
    ))
    FROM component_exports e
    WHERE e.component_id = c.id
  ) AS exports,
  (
    SELECT json_agg(t.name)
    FROM component_tags ct
    JOIN tags t ON ct.tag_id = t.id
    WHERE ct.component_id = c.id
  ) AS tags
FROM components c
LEFT JOIN users u ON c.author_id = u.id
LEFT JOIN component_quality q ON c.id = q.component_id;

-- Trending components view
CREATE OR REPLACE VIEW trending_components AS
SELECT
  c.id,
  c.name,
  c.version,
  c.description,
  c.category,
  c.stars,
  c.downloads,
  COUNT(cd.id) AS recent_downloads,
  c.downloads + (COUNT(cd.id) * 10) + (c.stars * 5) AS trending_score
FROM components c
LEFT JOIN component_downloads cd ON c.id = cd.component_id
  AND cd.downloaded_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY c.id
ORDER BY trending_score DESC;

-- ============================================================================
-- Sample Data (for testing)
-- ============================================================================

-- Create admin user
INSERT INTO users (username, email, password_hash, full_name, role, is_verified)
VALUES (
  'admin',
  'admin@thub.io',
  '$2b$10$rQZ5YZ5Y5Y5Y5Y5Y5Y5Y5O', -- Password: admin123 (bcrypt hash - change in production!)
  'T-Hub Administrator',
  'admin',
  TRUE
);

COMMENT ON DATABASE thub IS 'T-Hub - Thesaurus Hub for Software Components';
