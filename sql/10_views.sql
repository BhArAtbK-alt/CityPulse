-- ============================================================
-- CITYPULSE — STEP 10: USEFUL VIEWS (Read-Only)
-- ============================================================
-- These views simplify common Node.js queries. They are
-- NOT required but dramatically reduce query complexity.

-- ─────────────────────────────────────────────────────────────
-- V1: Enriched Reports Feed View
--     Joins author info + area name for the public feed
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_reports_feed AS
SELECT
  r.*,
  u.username                          AS author_username,
  u.avatar_color                      AS author_avatar_color,
  u.badge                             AS author_badge,
  ma.name                             AS area_name,
  ma.code                             AS area_code
FROM public.reports r
LEFT JOIN public.users u         ON r.user_id = u.id
LEFT JOIN public.municipal_areas ma ON r.area_id = ma.id
ORDER BY r.created_at DESC;

-- ─────────────────────────────────────────────────────────────
-- V2: Admin Dashboard Reports View
--     Zone-filtered view — use ST_Contains in WHERE from Node.js
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_admin_reports AS
SELECT
  r.*,
  u.username         AS author_username,
  u.avatar_color     AS author_avatar_color,
  ma.name            AS ward_area_name,
  an.note            AS latest_admin_note,
  an.created_at      AS note_created_at
FROM public.reports r
LEFT JOIN public.users u            ON r.user_id = u.id
LEFT JOIN public.municipal_areas ma ON r.area_id = ma.id
LEFT JOIN LATERAL (
  SELECT note, created_at
  FROM public.admin_notes an2
  WHERE an2.report_id = r.id
  ORDER BY an2.created_at DESC
  LIMIT 1
) an ON TRUE;

-- ─────────────────────────────────────────────────────────────
-- V3: Officials Performance View
--     Used by SAOfficials — resolution rate, SLA, zone stats
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_official_stats AS
SELECT
  u.id,
  u.username,
  u.email,
  u.avatar_color,
  u.role,
  u.created_at,
  ma.name                             AS area_name,
  ma.code                             AS area_code,
  ads.sla_hours,
  COUNT(r.id)                         AS total_reports_in_zone,
  COUNT(r.id) FILTER (WHERE r.status = 'resolved')
                                      AS resolved_reports_in_zone,
  CASE
    WHEN COUNT(r.id) > 0
    THEN ROUND(
      COUNT(r.id) FILTER (WHERE r.status = 'resolved')::NUMERIC
      / COUNT(r.id) * 100
    )
    ELSE 0
  END                                 AS resolution_rate,
  ROUND(
    EXTRACT(EPOCH FROM AVG(
      CASE WHEN r.status = 'resolved' AND r.resolved_at IS NOT NULL
           THEN r.resolved_at - r.created_at
      END
    )) / 3600
  )                                   AS avg_resolve_hours
FROM public.users u
LEFT JOIN public.municipal_areas ma ON u.id = ma.admin_id
LEFT JOIN public.admin_settings   ads ON u.id = ads.admin_id
LEFT JOIN public.reports r          ON ma.id = r.area_id
WHERE u.role IN ('admin', 'super_admin')
GROUP BY u.id, u.username, u.email, u.avatar_color, u.role,
         u.created_at, ma.name, ma.code, ads.sla_hours;

-- ─────────────────────────────────────────────────────────────
-- V4: Citizen Leaderboard View
--     Computed score = verified*10 + upvotes*2 + reports
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_leaderboard AS
SELECT
  u.id,
  u.username,
  u.avatar_color,
  u.badge,
  u.report_count,
  u.verified_count,
  u.total_upvotes,
  (u.verified_count * 10 + u.total_upvotes * 2 + u.report_count) AS score
FROM public.users u
WHERE u.role = 'user'
ORDER BY score DESC
LIMIT 100;

-- ─────────────────────────────────────────────────────────────
-- V5: Orphaned Reports View (Global Inbox for SA)
--     Reports with no active containing zone
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_orphaned_reports AS
SELECT
  r.*,
  u.username,
  u.avatar_color
FROM public.reports r
LEFT JOIN public.users u ON r.user_id = u.id
WHERE r.status != 'resolved'
  AND (
    r.area_id IS NULL
    OR r.is_orphaned = TRUE
    OR NOT EXISTS (
      SELECT 1 FROM public.municipal_areas ma
      WHERE ma.id = r.area_id AND ma.status = 'active'
    )
  )
ORDER BY r.created_at DESC;
