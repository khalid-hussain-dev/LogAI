-- ============================================================
-- LogAI — PostgreSQL Initialization
-- Creates required extensions before Alembic migrations run.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- Trigram similarity for search

