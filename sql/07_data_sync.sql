-- ============================================================
-- CITYPULSE — STEP 07: DATA INTEGRITY & STATE SYNC
-- ============================================================
-- Run this ONCE after initial data migration to fix any
-- inconsistencies from pre-trigger data or manual imports.

-- ─── Sync PostGIS geometry from lat/lng for all existing rows ─
UPDATE public.reports
SET location_geom = ST_SetSRID(ST_Point(longitude, latitude), 4326)
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND location_geom IS NULL;

-- ─── Sync report_count for all users ─────────────────────────
UPDATE public.users u
SET report_count = (
  SELECT COUNT(*) FROM public.reports r WHERE r.user_id = u.id
);

-- ─── Sync total_upvotes for all users ────────────────────────
UPDATE public.users u
SET total_upvotes = (
  SELECT COALESCE(SUM(r.upvote_count), 0)
  FROM public.reports r
  WHERE r.user_id = u.id
);

-- ─── Sync comment_count for all reports ──────────────────────
UPDATE public.reports r
SET comment_count = (
  SELECT COUNT(*) FROM public.comments c WHERE c.report_id = r.id
);

-- ─── Sync vote counters for all reports ──────────────────────
UPDATE public.reports r
SET
  upvote_count    = (SELECT COUNT(*) FROM public.votes v WHERE v.report_id = r.id AND v.vote_type = 'up'),
  downvote_count  = (SELECT COUNT(*) FROM public.votes v WHERE v.report_id = r.id AND v.vote_type = 'down'),
  unique_upvoters = (SELECT COUNT(DISTINCT user_id) FROM public.votes v WHERE v.report_id = r.id AND v.vote_type = 'up'),
  net_votes       = (SELECT COUNT(*) FILTER (WHERE vote_type = 'up') - COUNT(*) FILTER (WHERE vote_type = 'down')
                     FROM public.votes v WHERE v.report_id = r.id);

-- ─── Sync pinned_to_map based on unique_upvoters threshold ───
-- Default threshold = 5 (system default), respects per-area pin_threshold
UPDATE public.reports r
SET pinned_to_map = (r.unique_upvoters >= 5)
WHERE pinned_to_map = FALSE AND unique_upvoters >= 5;

-- ─── Sync municipal_areas confirmation state ──────────────────
UPDATE public.municipal_areas
SET is_confirmed = TRUE
WHERE admin_id IS NOT NULL AND is_confirmed = FALSE;

UPDATE public.municipal_areas
SET status = 'active'
WHERE admin_id IS NOT NULL AND is_confirmed = TRUE AND status = 'pending';

-- ─── Sync is_orphaned: reports with no containing active zone ─
UPDATE public.reports r
SET is_orphaned = TRUE
WHERE status != 'resolved'
  AND area_id IS NULL
  AND location_geom IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.municipal_areas ma
    WHERE ma.status = 'active'
      AND ST_Contains(ma.geofence, r.location_geom)
  );

-- ─── Backfill area_id for reports with geom inside a zone ────
UPDATE public.reports r
SET area_id = (
  SELECT ma.id FROM public.municipal_areas ma
  WHERE ma.status = 'active'
    AND ST_Contains(ma.geofence, r.location_geom)
  LIMIT 1
)
WHERE r.area_id IS NULL
  AND r.location_geom IS NOT NULL;
