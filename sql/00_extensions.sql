-- ============================================================
-- CITYPULSE — STEP 00: REQUIRED EXTENSIONS
-- Run this FIRST in Supabase SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;       -- Spatial geometry, ST_Contains, ST_Distance, etc.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- uuid_generate_v4() fallback
