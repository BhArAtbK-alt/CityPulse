-- ============================================================
-- CITYPULSE — STEP 04: CORE FUNCTIONS
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- A. Spatial Validation: detect overlapping jurisdictions
--    Called by admin.js before saving a boundary
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_area_overlap(
  new_geom    GEOMETRY,
  exclude_id  UUID DEFAULT NULL
)
RETURNS TABLE (conflicting_area_id UUID, area_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT id, name
  FROM public.municipal_areas
  WHERE status = 'active'
    AND id IS DISTINCT FROM exclude_id
    AND ST_Intersects(new_geom, geofence)
    -- Ignore shared boundary edges (tolerance = ~1 sqm)
    AND ST_Area(ST_Intersection(new_geom, geofence)::geography) > 1.0;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─────────────────────────────────────────────────────────────
-- B. Smart HTTP Bridge
--    Node.js calls supabase.rpc('exec_sql', {query_text}) for
--    parameterised-style queries via the HTTP bridge in db.js
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION exec_sql(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Route DML/DDL without SELECT result
  IF query_text ~* '^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)' THEN
    EXECUTE query_text;
    RETURN '[]'::jsonb;
  ELSE
    -- SELECT → wrap in json_agg
    EXECUTE 'SELECT json_agg(t) FROM (' || query_text || ') t' INTO result;
    RETURN COALESCE(result, '[]'::jsonb);
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- C. Ward Detection Helper
--    Given lat/lng, return which active municipal area contains it
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_area_for_point(lat FLOAT, lng FLOAT)
RETURNS TABLE (area_id UUID, area_name TEXT, area_code TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT id, name, code
  FROM public.municipal_areas
  WHERE status = 'active'
    AND ST_Contains(geofence, ST_SetSRID(ST_Point(lng, lat), 4326))
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─────────────────────────────────────────────────────────────
-- D. SLA Due Date Calculator
--    Returns due timestamp based on severity score and night-shift
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION calculate_sla_due(
  severity    INTEGER,
  is_night    BOOLEAN DEFAULT FALSE
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  base_hours   INTEGER;
  multiplier   FLOAT := 1.0;
BEGIN
  -- Base SLA from severity score
  base_hours := CASE
    WHEN severity >= 9 THEN 4    -- Emergency
    WHEN severity >= 7 THEN 12   -- High
    WHEN severity >= 4 THEN 48   -- Medium
    ELSE 72                       -- Low
  END;

  -- Night-shift SLA reduction (25% faster turnaround)
  IF is_night THEN
    multiplier := 0.75;
  END IF;

  RETURN NOW() + make_interval(hours => ROUND(base_hours * multiplier)::INTEGER);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ─────────────────────────────────────────────────────────────
-- E. Leaderboard Score Calculator
--    score = verified_count*10 + total_upvotes*2 + report_count
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION citizen_score(
  verified_count  INTEGER,
  total_upvotes   INTEGER,
  report_count    INTEGER
)
RETURNS INTEGER AS $$
  SELECT (verified_count * 10) + (total_upvotes * 2) + report_count;
$$ LANGUAGE sql IMMUTABLE;
