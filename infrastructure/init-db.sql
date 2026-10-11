-- FwP Database Initialization
-- This file runs automatically on first PostgreSQL container start

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Load full migration
\i /docker-entrypoint-initdb.d/02-migration-v1.sql
