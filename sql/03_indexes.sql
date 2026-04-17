-- ============================================================
-- CITYPULSE — STEP 03: SPATIAL INDEXES
-- ============================================================
-- Run after 01_tables.sql. These indexes are critical for
-- PostGIS ST_Contains / ST_Distance / ST_Intersects performance.

-- Reports: geom point (used for ward detection + deduplication)
CREATE INDEX IF NOT EXISTS idx_reports_location_geom
  ON public.reports USING GIST (location_geom);

-- Reports: area_id foreign key (for jurisdiction queries)
CREATE INDEX IF NOT EXISTS idx_reports_area_id
  ON public.reports (area_id);

-- Reports: status + area (common filter in admin queries)
CREATE INDEX IF NOT EXISTS idx_reports_status_area
  ON public.reports (area_id, status)
  WHERE status != 'resolved';

-- Reports: SLA (for cron job escalation checks)
CREATE INDEX IF NOT EXISTS idx_reports_sla
  ON public.reports (sla_due_at, is_escalated)
  WHERE status != 'resolved';

-- Reports: user + created_at (profile page + feed)
CREATE INDEX IF NOT EXISTS idx_reports_user_created
  ON public.reports (user_id, created_at DESC);

-- Reports: map pins (public map endpoint)
CREATE INDEX IF NOT EXISTS idx_reports_pinned
  ON public.reports (pinned_to_map, created_at DESC)
  WHERE pinned_to_map = TRUE;

-- Reports: deduplication (geom-proximity check for ~50m radius)
CREATE INDEX IF NOT EXISTS idx_reports_geom_category
  ON public.reports USING GIST (location_geom)
  WHERE status != 'resolved';

-- Municipal Areas: geofence (ST_Contains ward detection)
CREATE INDEX IF NOT EXISTS idx_areas_geofence
  ON public.municipal_areas USING GIST (geofence);

-- Municipal Areas: active status (most queries filter by this)
CREATE INDEX IF NOT EXISTS idx_areas_status_active
  ON public.municipal_areas (status)
  WHERE status = 'active';

-- Boundary Proposals: geofence (SA spatial checks)
CREATE INDEX IF NOT EXISTS idx_proposals_geofence
  ON public.boundary_proposals USING GIST (proposed_geofence);

-- Votes: report + user (toggle vote check)
CREATE INDEX IF NOT EXISTS idx_votes_report_user
  ON public.votes (report_id, user_id);

-- Comments: report_id (detail drawer fetch)
CREATE INDEX IF NOT EXISTS idx_comments_report
  ON public.comments (report_id, created_at ASC);

-- Escalations: status (pending escalations query)
CREATE INDEX IF NOT EXISTS idx_escalations_status
  ON public.escalations (status)
  WHERE status = 'pending';

-- Activity Log: actor + created (admin activity feed)
CREATE INDEX IF NOT EXISTS idx_activity_actor_created
  ON public.activity_log (actor_id, created_at DESC);

-- Audit Logs: entity (for lookup by entity)
CREATE INDEX IF NOT EXISTS idx_audit_entity
  ON public.audit_logs (entity_type, entity_id, created_at DESC);

-- Status History: report_id (timeline fetch)
CREATE INDEX IF NOT EXISTS idx_status_history_report
  ON public.report_status_history (report_id, created_at ASC);
