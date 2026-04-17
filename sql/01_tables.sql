-- ============================================================
-- CITYPULSE — STEP 01: CORE TABLES (Ordered by dependency)
-- ============================================================

-- ─────────────────────────────────────────────
-- A. USERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username        TEXT NOT NULL UNIQUE,
  email           TEXT NOT NULL UNIQUE,
  avatar_color    TEXT NOT NULL DEFAULT '#ff5a1f',
  bio             TEXT DEFAULT '',
  role            TEXT NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user','admin','super_admin')),
  report_count    INTEGER NOT NULL DEFAULT 0,
  verified_count  INTEGER NOT NULL DEFAULT 0,
  total_upvotes   INTEGER NOT NULL DEFAULT 0,
  badge           TEXT DEFAULT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- B. MUNICIPAL AREAS (PostGIS Geofencing)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.municipal_areas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  code             TEXT NOT NULL UNIQUE,
  city             TEXT NOT NULL DEFAULT '',
  state            TEXT NOT NULL DEFAULT '',
  geofence         GEOMETRY(MultiPolygon, 4326),
  color            TEXT NOT NULL DEFAULT '#ff5a1f',
  admin_id         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  population       INTEGER DEFAULT NULL,
  status           TEXT DEFAULT 'pending'
                   CHECK (status IN ('pending','active','suspended')),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  is_confirmed     BOOLEAN NOT NULL DEFAULT FALSE,
  requested_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  -- Per-category SLA thresholds (hours) — overrides system defaults
  threshold_config JSONB DEFAULT '{
    "garbage":     24,
    "pothole":     48,
    "water":       12,
    "electricity": 12,
    "sewage":      24,
    "vandalism":   48,
    "other":       72
  }'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- B2. BOUNDARY PROPOSALS (Awaiting SA approval)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.boundary_proposals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id           UUID REFERENCES public.municipal_areas(id) ON DELETE CASCADE,
  admin_id          UUID REFERENCES public.users(id) ON DELETE CASCADE,
  proposed_geofence GEOMETRY(MultiPolygon, 4326) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected')),
  review_note       TEXT DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- C. REPORTS (Rich civic issue record)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  area_id          UUID REFERENCES public.municipal_areas(id) ON DELETE SET NULL,

  -- Content
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  category         TEXT NOT NULL DEFAULT 'other',
  department       TEXT DEFAULT 'General',

  -- Media
  image_url        TEXT,
  after_image_url  TEXT,

  -- Geospatial
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION,
  location_geom    GEOMETRY(Point, 4326),   -- auto-populated by tr_sync_report_geom
  address          TEXT DEFAULT '',
  ward_name        TEXT DEFAULT 'Unknown',
  ward_code        TEXT DEFAULT 'UNKNOWN',

  -- Lifecycle
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','open','verified','in_progress',
                                     'resolved','acknowledged','dispatched')),
  priority         TEXT NOT NULL DEFAULT 'normal'
                   CHECK (priority IN ('low','normal','medium','high','critical','emergency')),
  severity_score   INTEGER DEFAULT 5 CHECK (severity_score BETWEEN 1 AND 10),
  due_date         TIMESTAMPTZ,
  sla_due_at       TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,

  -- Flags
  is_escalated     BOOLEAN DEFAULT FALSE,
  is_delayed       BOOLEAN DEFAULT FALSE,
  is_orphaned      BOOLEAN DEFAULT FALSE,
  is_legal_hold    BOOLEAN DEFAULT FALSE,
  ai_verified      BOOLEAN DEFAULT FALSE,
  is_night_report  BOOLEAN DEFAULT FALSE,
  is_anonymous     BOOLEAN DEFAULT FALSE,

  -- Relations
  delay_reason     TEXT,
  parent_report_id UUID REFERENCES public.reports(id),
  assigned_to      UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Social counters (maintained by triggers)
  net_votes        INTEGER NOT NULL DEFAULT 0,
  upvote_count     INTEGER NOT NULL DEFAULT 0,
  downvote_count   INTEGER NOT NULL DEFAULT 0,
  unique_upvoters  INTEGER NOT NULL DEFAULT 0,
  pinned_to_map    BOOLEAN NOT NULL DEFAULT FALSE,
  comment_count    INTEGER NOT NULL DEFAULT 0,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- D. VOTES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vote_type   TEXT NOT NULL CHECK (vote_type IN ('up','down')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(report_id, user_id)
);

-- ─────────────────────────────────────────────
-- E. COMMENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  is_official BOOLEAN DEFAULT FALSE,   -- TRUE = official admin reply
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- F. ESCALATIONS (Cross-ward transfers)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.escalations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  from_area_id    UUID REFERENCES public.municipal_areas(id) ON DELETE SET NULL,
  to_area_id      UUID REFERENCES public.municipal_areas(id) ON DELETE SET NULL,
  escalated_by    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','rejected','resolved')),
  resolution_note TEXT DEFAULT '',
  resolved_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- G. ACTIVITY LOG (Admin action audit trail)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  meta        JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- H. ADMIN SETTINGS (Per-admin config)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  area_id       UUID REFERENCES public.municipal_areas(id) ON DELETE SET NULL,
  pin_threshold INTEGER NOT NULL DEFAULT 5,
  area_name     TEXT DEFAULT '',
  geofence      GEOMETRY(MultiPolygon, 4326),
  auto_escalate BOOLEAN NOT NULL DEFAULT FALSE,
  notify_email  TEXT DEFAULT '',
  sla_hours     INTEGER NOT NULL DEFAULT 72,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- I. ADMIN NOTES (Internal annotations)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  admin_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  note        TEXT NOT NULL,
  status_to   TEXT,
  is_public   BOOLEAN DEFAULT FALSE,   -- TRUE = visible to report author
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- J. SYSTEM SETTINGS (Global defaults, SA-managed)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_sla_hours     INTEGER NOT NULL DEFAULT 72,
  default_pin_threshold INTEGER NOT NULL DEFAULT 5,
  night_shift_multiplier FLOAT DEFAULT 0.75,   -- 25% SLA reduction for night reports
  emergency_score_threshold INTEGER DEFAULT 7, -- severity >= this → auto-pin
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Seed one row if empty
INSERT INTO public.system_settings (default_sla_hours, default_pin_threshold)
SELECT 72, 5 WHERE NOT EXISTS (SELECT 1 FROM public.system_settings);

-- ─────────────────────────────────────────────
-- K. REPORT STATUS HISTORY (Progress timeline)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.report_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  old_status  TEXT,
  new_status  TEXT NOT NULL,
  changed_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  -- Displayed on citizen StatusTimeline
  changed_by_name   TEXT,
  changed_by_avatar TEXT,
  changed_by_role   TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- L. AUDIT LOGS (Immutable diff trail)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES public.users(id),
  action_type TEXT NOT NULL,  -- e.g. 'BOUNDARY_CHANGE', 'AREA_CONFIRM', 'SYSTEM_SETTINGS_UPDATE'
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  old_value   JSONB,
  new_value   JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
