-- ============================================================
-- CITYPULSE — STEP 08: MISSING COLUMNS (Alter Migrations)
-- ============================================================
-- Safe to run on existing DBs. All use IF NOT EXISTS / DO blocks.
-- Adds every column that the Node.js backend expects but may
-- not exist in older schema versions.

-- ─── reports table additions ─────────────────────────────────
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS is_orphaned      BOOLEAN DEFAULT FALSE;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS is_legal_hold    BOOLEAN DEFAULT FALSE;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS is_night_report  BOOLEAN DEFAULT FALSE;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS is_anonymous     BOOLEAN DEFAULT FALSE;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS is_delayed       BOOLEAN DEFAULT FALSE;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS delay_reason     TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS ai_verified      BOOLEAN DEFAULT FALSE;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS severity_score   INTEGER DEFAULT 5;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS sla_due_at       TIMESTAMPTZ;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS resolved_at      TIMESTAMPTZ;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS after_image_url  TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS department       TEXT DEFAULT 'General';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS ward_name        TEXT DEFAULT 'Unknown';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS ward_code        TEXT DEFAULT 'UNKNOWN';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS assigned_to      UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS parent_report_id UUID REFERENCES public.reports(id);

-- ─── Status CHECK constraint update (add new statuses) ───────
-- Supabase doesn't support ALTER COLUMN ... DROP CONSTRAINT easily,
-- so we use a safe DO block approach:
DO $$
BEGIN
  -- Drop old status constraint if it doesn't include all needed values
  ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
  ALTER TABLE public.reports
    ADD CONSTRAINT reports_status_check
    CHECK (status IN ('pending','open','verified','in_progress','resolved','acknowledged','dispatched'));
EXCEPTION
  WHEN others THEN NULL; -- Ignore if constraint already correct
END $$;

-- Priority CHECK constraint update
DO $$
BEGIN
  ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_priority_check;
  ALTER TABLE public.reports
    ADD CONSTRAINT reports_priority_check
    CHECK (priority IN ('low','normal','medium','high','critical','emergency'));
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- ─── municipal_areas additions ────────────────────────────────
ALTER TABLE public.municipal_areas ADD COLUMN IF NOT EXISTS requested_by     UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.municipal_areas ADD COLUMN IF NOT EXISTS threshold_config  JSONB DEFAULT '{"garbage":24,"pothole":48,"water":12,"electricity":12,"sewage":24,"vandalism":48,"other":72}'::jsonb;
ALTER TABLE public.municipal_areas ADD COLUMN IF NOT EXISTS is_confirmed      BOOLEAN DEFAULT FALSE;
ALTER TABLE public.municipal_areas ADD COLUMN IF NOT EXISTS population        INTEGER;

-- ─── admin_settings additions ─────────────────────────────────
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS auto_escalate BOOLEAN DEFAULT FALSE;
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS notify_email  TEXT DEFAULT '';
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS sla_hours     INTEGER DEFAULT 72;

-- ─── admin_notes additions ────────────────────────────────────
ALTER TABLE public.admin_notes ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

-- ─── comments additions ───────────────────────────────────────
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT FALSE;

-- ─── report_status_history additions ─────────────────────────
ALTER TABLE public.report_status_history ADD COLUMN IF NOT EXISTS changed_by_name   TEXT;
ALTER TABLE public.report_status_history ADD COLUMN IF NOT EXISTS changed_by_avatar TEXT;
ALTER TABLE public.report_status_history ADD COLUMN IF NOT EXISTS changed_by_role   TEXT;

-- ─── system_settings additions ────────────────────────────────
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS night_shift_multiplier   FLOAT DEFAULT 0.75;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS emergency_score_threshold INTEGER DEFAULT 7;
