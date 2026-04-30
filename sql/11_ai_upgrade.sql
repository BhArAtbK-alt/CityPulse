-- ============================================================
-- CityPulse AI Upgrade Migration
-- ============================================================
-- Run this ONLY if you want AI features enabled.
-- These columns are used by the AI classification and audit pipeline.
-- Safe to run multiple times (uses IF NOT EXISTS / safe ALTER patterns).
-- ============================================================

-- 1. Add AI-specific columns to reports (if not already present)
DO $$ 
BEGIN
  -- ai_verified: Whether this report was verified by AI image analysis
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'ai_verified') THEN
    ALTER TABLE public.reports ADD COLUMN ai_verified BOOLEAN DEFAULT FALSE;
  END IF;

  -- is_night_report: Report filed during night shift (11PM-6AM), affects SLA
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'is_night_report') THEN
    ALTER TABLE public.reports ADD COLUMN is_night_report BOOLEAN DEFAULT FALSE;
  END IF;

  -- severity_score: AI-assigned severity (1-10), used for priority calculation
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'severity_score') THEN
    ALTER TABLE public.reports ADD COLUMN severity_score INTEGER DEFAULT 5;
  END IF;

  -- is_legal_hold: Super Admin can prevent deletion of evidence
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'is_legal_hold') THEN
    ALTER TABLE public.reports ADD COLUMN is_legal_hold BOOLEAN DEFAULT FALSE;
  END IF;

  -- sla_status: Track whether SLA clock is running or paused
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'sla_status') THEN
    ALTER TABLE public.reports ADD COLUMN sla_status TEXT NOT NULL DEFAULT 'running' CHECK (sla_status IN ('running', 'paused'));
  END IF;

  -- paused_at: Timestamp when SLA was paused
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'paused_at') THEN
    ALTER TABLE public.reports ADD COLUMN paused_at TIMESTAMPTZ;
  END IF;

  -- pause_reason: Why SLA was paused
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'pause_reason') THEN
    ALTER TABLE public.reports ADD COLUMN pause_reason TEXT;
  END IF;
END $$;

-- 2. Audit logs table (for AI verification trail and admin boundary changes)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  old_value   JSONB,
  new_value   JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service full access" ON public.audit_logs;
CREATE POLICY "Service full access" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

-- 3. System settings table (global defaults for SLA, thresholds)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_sla_hours     INTEGER NOT NULL DEFAULT 72,
  default_pin_threshold INTEGER NOT NULL DEFAULT 5,
  max_report_distance   INTEGER NOT NULL DEFAULT 200,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default row if none exists
INSERT INTO public.system_settings (default_sla_hours, default_pin_threshold, max_report_distance)
SELECT 72, 5, 200
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service full access" ON public.system_settings;
CREATE POLICY "Service full access" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);



-- 5. Report Status History (for StatusTimeline component)
CREATE TABLE IF NOT EXISTS public.report_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  old_status  TEXT,
  new_status  TEXT NOT NULL,
  changed_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.report_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service full access" ON public.report_status_history;
CREATE POLICY "Service full access" ON public.report_status_history FOR ALL USING (true) WITH CHECK (true);

-- 6. Auto-record status changes trigger
CREATE OR REPLACE FUNCTION track_report_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.report_status_history (report_id, old_status, new_status)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_track_status ON public.reports;
CREATE TRIGGER tr_track_status
AFTER UPDATE OF status ON public.reports
FOR EACH ROW EXECUTE FUNCTION track_report_status_change();

-- 7. Role permissions table (for RBAC middleware)
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role          TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  UNIQUE(role, permission_id)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service full access" ON public.role_permissions;
CREATE POLICY "Service full access" ON public.role_permissions FOR ALL USING (true) WITH CHECK (true);

-- Insert default permissions
INSERT INTO public.role_permissions (role, permission_id) VALUES
  ('super_admin', 'manage_areas'),
  ('super_admin', 'manage_users'),
  ('super_admin', 'view_audit_logs'),
  ('super_admin', 'system_settings'),
  ('super_admin', 'legal_hold'),
  ('admin', 'manage_reports'),
  ('admin', 'manage_escalations'),
  ('admin', 'view_analytics')
ON CONFLICT (role, permission_id) DO NOTHING;
