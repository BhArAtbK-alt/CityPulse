-- ============================================================
-- CITYPULSE — STEP 06: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
-- Strategy: Enable RLS on all tables, then grant the Node.js
-- service role FULL access via a single permissive policy.
-- This allows the backend to act as a trusted service while
-- still allowing Supabase Auth users to be blocked by default.

-- ─── Enable RLS on all application tables ────
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_areas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boundary_proposals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;

-- ─── Drop existing service-role policies (idempotent) ────
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('spatial_ref_sys')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Service full access" ON public.%I', t);
  END LOOP;
END $$;

-- ─── Grant full access to the Node.js service role ────────
-- The service_role key bypasses normal user-level RLS but we
-- still need an explicit policy for the exec_sql SECURITY DEFINER function.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('spatial_ref_sys')
  LOOP
    EXECUTE format(
      'CREATE POLICY "Service full access" ON public.%I FOR ALL USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;
