-- ============================================================
-- CITYPULSE — MASTER RUN FILE
-- Run this entire file to set up a fresh Supabase database.
-- Paste into Supabase SQL Editor → Run All
-- ============================================================
-- Execution order matters — dependencies must exist before references.

-- 00: Extensions (PostGIS + UUID)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 01: Core Tables
\i sql/01_tables.sql

-- 02: RBAC Permissions
\i sql/02_permissions.sql

-- 03: Spatial + Performance Indexes
\i sql/03_indexes.sql

-- 04: Core Functions (exec_sql, check_area_overlap, etc.)
\i sql/04_functions.sql

-- 05: Automated Triggers
\i sql/05_triggers.sql

-- 06: Row Level Security Policies
\i sql/06_rls_policies.sql

-- 07: Data Sync (run ONCE after initial data import)
-- \i sql/07_data_sync.sql   ← Uncomment only when needed

-- 08: Schema Migrations (safe to run on existing DB)
\i sql/08_migrations.sql

-- 09: Storage Bucket
\i sql/09_storage.sql

-- 10: Views (optional but helpful)
\i sql/10_views.sql

-- ============================================================
-- DONE — CityPulse database is ready.
-- ============================================================
