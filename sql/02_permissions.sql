-- ============================================================
-- CITYPULSE — STEP 02: PERMISSIONS & RBAC
-- ============================================================

CREATE TABLE IF NOT EXISTS public.permissions (
  id          TEXT PRIMARY KEY,  -- e.g. 'MAP_EDIT', 'USER_MANAGE'
  description TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role          TEXT NOT NULL,   -- 'user' | 'admin' | 'super_admin'
  permission_id TEXT NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_id)
);

-- ─── Seed Permissions ───────────────────────
INSERT INTO public.permissions (id, description) VALUES
  ('MAP_EDIT',       'Create or modify municipal boundaries'),
  ('USER_MANAGE',    'Promote, demote or suspend users'),
  ('REPORT_DELETE',  'Permanently remove reports from the system'),
  ('OFFICIAL_VERIFY','Confirm municipal admin authority'),
  ('SLA_CONFIG',     'Modify resolution time thresholds'),
  ('GLOBAL_STATS',   'Access city-wide performance analytics'),
  ('ACTIVITY_VIEW',  'View system-wide activity logs')
ON CONFLICT DO NOTHING;

-- ─── Seed Role → Permission Mappings ────────
INSERT INTO public.role_permissions (role, permission_id) VALUES
  -- Super Admin gets everything
  ('super_admin', 'MAP_EDIT'),
  ('super_admin', 'USER_MANAGE'),
  ('super_admin', 'REPORT_DELETE'),
  ('super_admin', 'OFFICIAL_VERIFY'),
  ('super_admin', 'SLA_CONFIG'),
  ('super_admin', 'GLOBAL_STATS'),
  ('super_admin', 'ACTIVITY_VIEW'),
  -- Municipal Admin gets SLA config only
  ('admin', 'SLA_CONFIG')
ON CONFLICT DO NOTHING;
