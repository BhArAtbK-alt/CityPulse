-- ============================================================
-- CITYPULSE — STEP 05: AUTOMATED TRIGGERS
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- TRIGGER A: Auto-sync PostGIS geometry from lat/lng
--   Fires on INSERT or when latitude/longitude is updated
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_report_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location_geom := ST_SetSRID(ST_Point(NEW.longitude, NEW.latitude), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_report_geom ON public.reports;
CREATE TRIGGER tr_sync_report_geom
  BEFORE INSERT OR UPDATE OF latitude, longitude ON public.reports
  FOR EACH ROW EXECUTE FUNCTION sync_report_geom();


-- ─────────────────────────────────────────────────────────────
-- TRIGGER B: Auto-update users.report_count on INSERT/DELETE
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_user_report_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.users SET report_count = report_count + 1 WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.users SET report_count = GREATEST(report_count - 1, 0) WHERE id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_update_report_count ON public.reports;
CREATE TRIGGER tr_update_report_count
  AFTER INSERT OR DELETE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION update_user_report_count();


-- ─────────────────────────────────────────────────────────────
-- TRIGGER C: Log every status change to report_status_history
--   Node.js subsequently backfills changed_by, note fields
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_report_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.report_status_history
      (report_id, old_status, new_status, created_at)
    VALUES
      (NEW.id, OLD.status, NEW.status, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_log_status_change ON public.reports;
CREATE TRIGGER tr_log_status_change
  AFTER UPDATE OF status ON public.reports
  FOR EACH ROW EXECUTE FUNCTION log_report_status_change();


-- ─────────────────────────────────────────────────────────────
-- TRIGGER D: Boundary Shift Auto-Reassignment
--   When a municipal_areas.geofence changes, unresolved reports
--   are reassigned to whichever active zone now contains them.
--   Reports that fall outside ALL zones become is_orphaned = TRUE.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_boundary_shift()
RETURNS TRIGGER AS $$
BEGIN
  -- Only execute if geofence actually changed
  IF OLD.geofence IS DISTINCT FROM NEW.geofence THEN

    -- 1. Reports that were in this zone but now fall OUTSIDE new boundary
    UPDATE public.reports r
    SET
      area_id = (
        SELECT id FROM public.municipal_areas ma
        WHERE ma.status = 'active'
          AND ST_Contains(ma.geofence, r.location_geom)
        LIMIT 1
      ),
      is_orphaned = NOT EXISTS (
        SELECT 1 FROM public.municipal_areas ma
        WHERE ma.status = 'active'
          AND ST_Contains(ma.geofence, r.location_geom)
      ),
      updated_at = NOW()
    WHERE r.area_id = OLD.id
      AND NOT ST_Contains(NEW.geofence, r.location_geom)
      AND r.status != 'resolved';

    -- 2. Orphaned reports that now fall INSIDE the updated boundary
    UPDATE public.reports r
    SET
      area_id     = NEW.id,
      is_orphaned = FALSE,
      updated_at  = NOW()
    WHERE (r.area_id IS NULL OR r.is_orphaned = TRUE)
      AND ST_Contains(NEW.geofence, r.location_geom)
      AND r.status != 'resolved';

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_boundary_shift ON public.municipal_areas;
CREATE TRIGGER tr_boundary_shift
  AFTER UPDATE OF geofence ON public.municipal_areas
  FOR EACH ROW EXECUTE FUNCTION handle_boundary_shift();


-- ─────────────────────────────────────────────────────────────
-- TRIGGER E: Legal Hold — Block deletion of evidence
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_legal_hold()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_legal_hold = TRUE THEN
    RAISE EXCEPTION 'Report % is under Legal Hold and cannot be deleted.', OLD.id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_check_legal_hold ON public.reports;
CREATE TRIGGER tr_check_legal_hold
  BEFORE DELETE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION check_legal_hold();


-- ─────────────────────────────────────────────────────────────
-- TRIGGER F: Auto-update reports.updated_at on any change
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_reports_updated_at ON public.reports;
CREATE TRIGGER tr_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS tr_areas_updated_at ON public.municipal_areas;
CREATE TRIGGER tr_areas_updated_at
  BEFORE UPDATE ON public.municipal_areas
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS tr_escalations_updated_at ON public.escalations;
CREATE TRIGGER tr_escalations_updated_at
  BEFORE UPDATE ON public.escalations
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
