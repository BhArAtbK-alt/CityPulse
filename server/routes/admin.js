// server/routes/admin.js — Optimized for Urban Echo (PostGIS + Strict Jurisdiction)
const express  = require("express");
const router   = express.Router();
const { v4: uuidv4 } = require("uuid");
const db       = require("../utils/db");
const supabase = require("../utils/supabase");
const { authMiddleware, adminOnly, logActivity, logAudit } = require("../middleware/auth");
const upload = require("../middleware/upload");
const { AI_ENABLED, verifyResolution } = require("../features/ai");
const fs = require("fs").promises;
const path = require("path");
const axios = require("axios");

router.use(authMiddleware, adminOnly);

/**
 * HELPER: Fetch admin settings and check confirmation status
 * INJECTS Global Defaults if local settings are missing values
 */
async function getAdminAccess(adminId) {
  const { rows } = await db.query(`
    SELECT s.*, ma.is_confirmed, ma.status,
           ST_AsGeoJSON(ma.geofence)::jsonb as official_geofence,
           ST_AsGeoJSON(s.geofence)::jsonb as geofence,
           sys.default_sla_hours as global_sla,
           sys.default_pin_threshold as global_threshold
    FROM admin_settings s
    LEFT JOIN municipal_areas ma ON s.area_id = ma.id
    CROSS JOIN (SELECT default_sla_hours, default_pin_threshold FROM system_settings LIMIT 1) sys
    WHERE s.admin_id = $1
  `, [adminId]);
  
  const data = rows[0];
  if (data) {
    data.sla_hours = data.sla_hours || data.global_sla;
    data.pin_threshold = data.pin_threshold || data.global_threshold;
  }
  return data;
}

// GET /api/admin/settings
router.get("/settings", async (req, res) => {
  try {
    const data = await getAdminAccess(req.user.id);
    
    // If no settings exist yet, we still return a base object to avoid frontend crashes
    if (!data) {
      const { rows: sys } = await db.query("SELECT * FROM system_settings LIMIT 1");
      return res.json({ 
        success: true, 
        data: { 
          pin_threshold: sys[0].default_pin_threshold, 
          sla_hours: sys[0].default_sla_hours,
          is_confirmed: false, 
          status: 'none' 
        } 
      });
    }
    
    res.json({ success: true, data });
  } catch (e) { 
    console.error("[admin settings get]", e);
    res.status(500).json({ error: "Failed" }); 
  }
});

// POST /api/admin/request-area — First-time ward registration
router.post("/request-area", async (req, res) => {
  try {
    const { name, geofence, code } = req.body;
    if (!name || !geofence || !code) return res.status(400).json({ error: "Name, Code and Boundary required" });

    // 1. Check if Admin already has an area
    const access = await getAdminAccess(req.user.id);
    if (access?.area_id) return res.status(400).json({ error: "Area already assigned or pending." });

    // 2. Spatial Overlap Check
    const { rows: conflicts } = await db.query(
      "SELECT * FROM check_area_overlap(ST_Multi(ST_GeomFromGeoJSON($1)))",
      [JSON.stringify(geofence)]
    );
    if (conflicts.length > 0) {
      return res.status(409).json({ 
        error: `Boundary conflict! This area overlaps with: ${conflicts.map(c => c.area_name).join(", ")}` 
      });
    }

    // 3. Create the pending Municipal Area
    const areaId = uuidv4();
    await db.query(`
      INSERT INTO municipal_areas (id, name, code, geofence, requested_by, status, is_confirmed)
      VALUES ($1, $2, $3, ST_Multi(ST_GeomFromGeoJSON($4)), $5, 'pending', FALSE)
    `, [areaId, name, code.toUpperCase(), JSON.stringify(geofence), req.user.id]);

    // 4. Create/Update Admin Settings
    await db.query(`
      INSERT INTO admin_settings (id, admin_id, area_id, area_name, geofence)
      VALUES ($1, $2, $3, $4, ST_Multi(ST_GeomFromGeoJSON($5)))
      ON CONFLICT (admin_id) DO UPDATE SET area_id = $3, area_name = $4, geofence = ST_Multi(ST_GeomFromGeoJSON($5))
    `, [uuidv4(), req.user.id, areaId, name, JSON.stringify(geofence)]);

    res.json({ success: true, message: "Area request submitted for Super Admin verification." });
  } catch (e) {
    console.error("[request-area]", e);
    res.status(500).json({ error: "Submission failed" });
  }
});

// GET /api/admin/neighboring-areas
router.get("/neighboring-areas", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT id, name as area_name, ST_AsGeoJSON(geofence)::jsonb as geofence, color 
      FROM municipal_areas 
      WHERE status = 'active' AND admin_id IS NOT NULL AND admin_id != $1
    `, [req.user.id]);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ error: "Failed to fetch neighbors" }); }
});

// GET /api/admin/available-areas — Active areas that don't yet have an assigned admin
router.get("/available-areas", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT id, name, code, city, state, color, population
      FROM municipal_areas
      WHERE status = 'active' AND admin_id IS NULL
      ORDER BY name ASC
    `);
    res.json({ success: true, data: rows });
  } catch (e) { 
    console.error("[available-areas]", e);
    res.status(500).json({ error: "Failed to fetch available areas" }); 
  }
});

// GET /api/admin/reports — Spatially Filtered by PostGIS (Strict active only)
router.get("/reports", async (req, res) => {
  try {
    const access = await getAdminAccess(req.user.id);
    if (!access || access.status !== 'active') {
      return res.status(403).json({ success: false, error: "Jurisdiction not yet active or confirmed by Super Admin." });
    }

    const { rows: reports } = await db.query(`
      SELECT r.*, u.username, u.avatar_color
      FROM reports r
      LEFT JOIN users u ON r.user_id = u.id
      JOIN municipal_areas ma ON ma.id = $1
      WHERE ST_Contains(ma.geofence, r.location_geom)
      ORDER BY r.created_at DESC
    `, [access.area_id]);
    
    res.json({ success: true, data: reports });
  } catch (e) {
    console.error("[admin reports]", e);
    res.status(500).json({ success: false, error: "Spatial query failed" });
  }
});

// GET /api/admin/stats — Deep Analytics for Urban Echo
router.get("/stats", async (req, res) => {
  try {
    const access = await getAdminAccess(req.user.id);
    if (!access || access.status !== 'active') return res.status(403).json({ error: "Jurisdiction inactive" });

    // 1. Core Totals & Status
    const statsSql = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE r.status = 'pending') as pending,
        COUNT(*) FILTER (WHERE r.status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE r.status = 'resolved') as resolved,
        COUNT(*) FILTER (WHERE r.is_escalated = TRUE) as escalated,
        COUNT(*) FILTER (WHERE r.is_delayed = TRUE) as delayed,
        AVG(EXTRACT(EPOCH FROM (r.resolved_at - r.created_at))/3600)::int as avg_resolve_hours
      FROM reports r
      JOIN municipal_areas ma ON ma.id = $1
      WHERE ST_Contains(ma.geofence, r.location_geom)
    `;

    // 2. Category Distribution
    const catSql = `
      SELECT r.category, COUNT(*) as count 
      FROM reports r
      JOIN municipal_areas ma ON ma.id = $1
      WHERE ST_Contains(ma.geofence, r.location_geom)
      GROUP BY r.category
    `;

    // 3. 30-Day Trend (Daily)
    const trendSql = `
      SELECT TO_CHAR(r.created_at, 'YYYY-MM-DD') as day, COUNT(*) as count
      FROM reports r
      JOIN municipal_areas ma ON ma.id = $1
      WHERE ST_Contains(ma.geofence, r.location_geom)
      AND r.created_at > NOW() - INTERVAL '30 days'
      GROUP BY day ORDER BY day ASC
    `;

    const [statsRes, catRes, trendRes] = await Promise.all([
      db.query(statsSql, [access.area_id]),
      db.query(catSql, [access.area_id]),
      db.query(trendSql, [access.area_id])
    ]);

    res.json({ 
      success: true, 
      data: {
        ...statsRes.rows[0],
        by_category: catRes.rows,
        trend_30d: trendRes.rows
      }
    });
  } catch (e) { 
    console.error("[admin stats]", e);
    res.status(500).json({ error: "Analytics failed" }); 
  }
});

// PATCH /api/admin/reports/:id/status
router.patch("/reports/:id/status", async (req, res) => {
  try {
    const { status, note } = req.body;
    await db.query("UPDATE reports SET status = $1, updated_at = NOW() WHERE id = $2", [status, req.params.id]);
    
    // Update the last history entry with who changed it and why
    await db.query(`
      UPDATE report_status_history 
      SET changed_by = $1, note = $2 
      WHERE report_id = $3 AND new_status = $4 
      AND created_at >= NOW() - INTERVAL '5 seconds'
    `, [req.user.id, note || "Status updated by Official", req.params.id, status]);

    // Emit real-time socket event so the citizen gets notified
    const { rows: fullRows } = await db.query(`
      SELECT r.*, u.username, u.avatar_color, u.badge
      FROM reports r LEFT JOIN users u ON r.user_id = u.id
      WHERE r.id = $1
    `, [req.params.id]);
    if (fullRows[0] && req.app.locals.io) {
      req.app.locals.io.emit("status_update", { 
        reportId: req.params.id, 
        status, 
        report: fullRows[0] 
      });
    }

    res.json({ success: true });
  } catch (e) { 
    console.error("[status update]", e);
    res.status(500).json({ error: "Update failed" }); 
  }
});

// PATCH /api/admin/reports/:id/resolve — WITH DISTANCE CHECK + SUPABASE STORAGE
router.patch("/reports/:id/resolve", upload.single("after_image"), async (req, res) => {
  try {
    const { lat, lng, note } = req.body;
    if (!req.file) return res.status(400).json({ error: "After-photo required" });

    const { rows: reportRows } = await db.query("SELECT latitude, longitude FROM reports WHERE id = $1", [req.params.id]);
    const report = reportRows[0];

    // Distance check: Official must be within 200m of the issue
    if (lat && lng && report.latitude && report.longitude) {
      const distSql = `SELECT ST_Distance(ST_MakePoint($1, $2)::geography, ST_MakePoint($3, $4)::geography) as dist`;
      const { rows: distRes } = await db.query(distSql, [lng, lat, report.longitude, report.latitude]);
      if (distRes[0].dist > 200) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ error: `Verification failed. You are ${Math.round(distRes[0].dist)}m away. Must be within 200m.` });
      }
    }

    // AI AUDIT: If AI is enabled and original image exists, verify resolution
    let aiAuditNote = "Manually Resolved (Distance Verified)";
    if (AI_ENABLED && report.image_url) {
      try {
        let beforeBuffer;
        const { rows: fullReport } = await db.query("SELECT image_url FROM reports WHERE id = $1", [req.params.id]);
        const imgUrl = fullReport[0]?.image_url;
        if (imgUrl) {
          if (imgUrl.startsWith("http")) {
            const response = await axios.get(imgUrl, { responseType: 'arraybuffer' });
            beforeBuffer = Buffer.from(response.data);
          } else {
            const beforeAbs = path.join(__dirname, "..", imgUrl.replace("/uploads/", "uploads/"));
            beforeBuffer = await require("fs").readFileSync(beforeAbs);
          }
          const afterBuffer = await require("fs").readFileSync(req.file.path);
          const audit = await verifyResolution(beforeBuffer, "image/jpeg", afterBuffer, req.file.mimetype);
          if (!audit.is_resolved) {
            await fs.unlink(req.file.path).catch(() => {});
            return res.status(400).json({ success: false, error: "AI Audit failed: Issue not resolved.", details: audit.comment });
          }
          aiAuditNote = `AI-Verified Resolve: ${audit.comment}`;
        }
      } catch (aiErr) {
        console.warn("[AI Resolve Audit] Skipped:", aiErr.message);
        // AI failure is non-blocking — proceed with manual resolve
      }
    }

    // Upload after-image to Supabase Storage (same as citizen report uploads)
    let afterUrl = `/uploads/${req.file.filename}`;
    try {
      const sharp = require("sharp");
      const compressedBuffer = await sharp(req.file.path)
        .resize(1200, 1200, { fit: "inside", withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();

      const fileName = `resolutions/${uuidv4()}.jpg`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("images")
        .upload(fileName, compressedBuffer, { contentType: "image/jpeg" });

      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from("images").getPublicUrl(fileName);
        afterUrl = publicUrl;
      }
    } catch (uploadErr) {
      console.error("[resolve upload error]", uploadErr.message);
    } finally {
      await fs.unlink(req.file.path).catch(() => {});
    }

    await db.query("UPDATE reports SET status = 'resolved', after_image_url = $1, resolved_at = NOW() WHERE id = $2", [afterUrl, req.params.id]);
    
    await db.query(`
      UPDATE report_status_history 
      SET changed_by = $1, note = $2 
      WHERE report_id = $3 AND new_status = 'resolved' 
      AND created_at >= NOW() - INTERVAL '5 seconds'
    `, [req.user.id, aiAuditNote, req.params.id]);

    await db.query(`
      INSERT INTO admin_notes (id, report_id, admin_id, note, status_to)
      VALUES ($1, $2, $3, $4, 'resolved')
    `, [uuidv4(), req.params.id, req.user.id, aiAuditNote]);

    // Emit status_update so citizen gets notified
    if (req.app.locals.io) {
      req.app.locals.io.emit("status_update", { reportId: req.params.id, status: "resolved" });
    }

    res.json({ success: true, message: "Resolved and distance verified.", after_image_url: afterUrl });
  } catch (e) { 
    console.error("[resolve]", e);
    res.status(500).json({ error: "Resolution failed" }); 
  }
});

// PATCH /api/admin/reports/:id/delay
router.patch("/reports/:id/delay", async (req, res) => {
  try {
    const { hours, reason } = req.body;
    // PostgreS Syntax Corrected
    await db.query(`
      UPDATE reports 
      SET due_date = due_date + ($1 || ' hours')::interval, 
          is_delayed = TRUE, 
          delay_reason = $2 
      WHERE id = $3
    `, [hours, reason, req.params.id]);

    await db.query(`
      INSERT INTO admin_notes (id, report_id, admin_id, note)
      VALUES ($1, $2, $3, $4)
    `, [uuidv4(), req.params.id, req.user.id, `Extended SLA by ${hours}h: ${reason}`]);

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: "Delay failed" }); }
});

// PUT /api/admin/settings — WITH OVERLAP VALIDATION
router.put("/settings", async (req, res) => {
  try {
    const { pin_threshold, geofence, area_name, sla_hours, threshold_config } = req.body;
    const access = await getAdminAccess(req.user.id);
    const areaId = access?.area_id;

    // 1. SPATIAL VALIDATION: Check for overlaps with other ACTIVE zones
    if (geofence && areaId) {
      const { rows: conflicts } = await db.query(
        "SELECT * FROM check_area_overlap(ST_Multi(ST_GeomFromGeoJSON($1)), $2)",
        [JSON.stringify(geofence), areaId]
      );
      if (conflicts.length > 0) {
        return res.status(409).json({ 
          success: false, 
          error: `Boundary conflict! This area overlaps with: ${conflicts.map(c => c.area_name).join(", ")}` 
        });
      }
    }

    // 2. STATUS RESET: If geofence changes, status goes back to 'pending'
    let currentGeofence = null;
    if (areaId) {
        const { rows: curr } = await db.query("SELECT ST_AsGeoJSON(geofence)::jsonb as geofence, status, threshold_config FROM municipal_areas WHERE id = $1", [areaId]);
        currentGeofence = curr[0]?.geofence;
    }

    let newStatus = access?.status || 'pending';
    if (geofence && JSON.stringify(geofence) !== JSON.stringify(currentGeofence)) {
      newStatus = 'pending';
      // AUDIT THE BOUNDARY CHANGE
      await logAudit(req.user.id, 'BOUNDARY_CHANGE_REQUEST', 'area', areaId, currentGeofence, geofence);
    }

    await db.query(`
      UPDATE admin_settings SET 
        pin_threshold = $1, 
        geofence = ST_Multi(ST_GeomFromGeoJSON($2)), 
        area_name = $3, 
        sla_hours = $4
      WHERE admin_id = $5
    `, [pin_threshold, JSON.stringify(geofence), area_name, sla_hours, req.user.id]);

    if (areaId) {
      await db.query(`
        UPDATE municipal_areas SET 
          status = $1, 
          geofence = ST_Multi(ST_GeomFromGeoJSON($2)),
          threshold_config = $3
        WHERE id = $4
      `, [newStatus, JSON.stringify(geofence), threshold_config || access.threshold_config, areaId]);
    }

    res.json({ success: true, status: newStatus });
  } catch (e) { res.status(500).json({ error: "Save failed" }); }
});

// GET /api/admin/map — Optimized PostGIS Map Data
router.get("/map", async (req, res) => {
  try {
    const access = await getAdminAccess(req.user.id);
    if (!access || access.status !== 'active') return res.status(403).json({ error: "Inactive" });

    // 1. Fetch Reports in Jurisdiction
    const reportsSql = `
      SELECT r.*, u.username, u.avatar_color
      FROM reports r
      LEFT JOIN users u ON r.user_id = u.id
      JOIN municipal_areas ma ON ma.id = $1
      WHERE ST_Contains(ma.geofence, r.location_geom)
    `;

    // 2. Fetch Neighboring Active Zones
    const neighborsSql = `
      SELECT ma2.id, ma2.name as area_name, ST_AsGeoJSON(ma2.geofence)::jsonb as geofence, ma2.color
      FROM municipal_areas ma1
      JOIN municipal_areas ma2 ON ma2.id != ma1.id
      WHERE ma1.id = $1 AND ma2.status = 'active'
      AND ST_Intersects(ma1.geofence, ma2.geofence)
    `;

    const [reportsRes, neighborsRes] = await Promise.all([
      db.query(reportsSql, [access.area_id]),
      db.query(neighborsSql, [access.area_id])
    ]);

    res.json({
      success: true,
      my_zone: { id: access.area_id, geofence: access.official_geofence || access.geofence },
      reports: reportsRes.rows,
      neighboring_zones: neighborsRes.rows
    });
  } catch (e) { 
    console.error("[admin map]", e);
    res.status(500).json({ error: "Map query failed" }); 
  }
});

// GET /api/admin/activity
router.get("/activity", async (req, res) => {
  try {
    const access = await getAdminAccess(req.user.id);
    if (!access || access.status !== 'active') return res.status(403).json({ error: "Inactive" });

    const { limit = 8 } = req.query;
    // Fetch logs related to this admin's area or their own actions
    const { rows } = await db.query(`
      SELECT al.*, u.username, u.avatar_color
      FROM activity_log al
      LEFT JOIN users u ON al.actor_id = u.id
      WHERE al.actor_id = $1
      OR (al.entity_type = 'area' AND al.entity_id = $2)
      ORDER BY al.created_at DESC
      LIMIT $3
    `, [req.user.id, access.area_id, parseInt(limit)]);

    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ error: "Activity failed" }); }
});

// GET /api/admin/escalations
router.get("/escalations", async (req, res) => {
  try {
    const access = await getAdminAccess(req.user.id);
    if (!access || access.status !== 'active') return res.status(403).json({ error: "Inactive" });

    // Incoming: Directed TO this admin's area
    const { rows: incoming } = await db.query(`
      SELECT e.*, r.title, r.category, ma.name as from_area_name
      FROM escalations e
      JOIN reports r ON e.report_id = r.id
      JOIN municipal_areas ma ON e.from_area_id = ma.id
      WHERE e.to_area_id = $1
      ORDER BY e.created_at DESC
    `, [access.area_id]);

    // Outgoing: Escalated FROM this admin's area
    const { rows: outgoing } = await db.query(`
      SELECT e.*, r.title, r.category, ma.name as to_area_name
      FROM escalations e
      JOIN reports r ON e.report_id = r.id
      LEFT JOIN municipal_areas ma ON e.to_area_id = ma.id
      WHERE e.from_area_id = $1
      ORDER BY e.created_at DESC
    `, [access.area_id]);

    res.json({ success: true, incoming, outgoing });
  } catch (e) { res.status(500).json({ error: "Escalations failed" }); }
});

// PATCH /api/admin/escalations/:id
router.patch("/escalations/:id", async (req, res) => {
  try {
    const { status, resolution_note } = req.body;
    const { rows: eRows } = await db.query("SELECT * FROM escalations WHERE id = $1", [req.params.id]);
    const esc = eRows[0];
    if (!esc) return res.status(404).json({ error: "Not found" });

    await db.query(`
      UPDATE escalations 
      SET status = $1, resolution_note = $2, resolved_by = $3, updated_at = NOW() 
      WHERE id = $4
    `, [status, resolution_note, req.user.id, req.params.id]);

    // If accepted, actually transfer the report to the new area
    if (status === 'accepted') {
      await db.query("UPDATE reports SET area_id = $1, is_escalated = FALSE WHERE id = $2", [esc.to_area_id, esc.report_id]);
    }

    await logActivity(req.user.id, `escalation_${status}`, "escalation", req.params.id, { status });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: "Response failed" }); }
});

// POST /api/admin/escalations — Create a new escalation to a neighbor zone
router.post("/escalations", async (req, res) => {
  try {
    const { report_id, to_area_id, reason } = req.body;
    if (!report_id || !to_area_id || !reason) {
      return res.status(400).json({ error: "report_id, to_area_id, and reason are required" });
    }

    const access = await getAdminAccess(req.user.id);
    if (!access || access.status !== 'active') {
      return res.status(403).json({ error: "Jurisdiction inactive" });
    }

    // Verify the report belongs to this admin's zone
    const { rows: reportRows } = await db.query(
      "SELECT id, area_id, status FROM reports WHERE id = $1",
      [report_id]
    );
    const report = reportRows[0];
    if (!report) return res.status(404).json({ error: "Report not found" });
    if (report.status === 'resolved') {
      return res.status(400).json({ error: "Cannot escalate a resolved report" });
    }

    // Check if escalation already exists
    const { rows: existing } = await db.query(
      "SELECT id FROM escalations WHERE report_id = $1 AND status = 'pending'",
      [report_id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "An escalation for this report is already pending" });
    }

    const id = uuidv4();
    await db.query(`
      INSERT INTO escalations (id, report_id, from_area_id, to_area_id, reason, escalated_by, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
    `, [id, report_id, access.area_id, to_area_id, reason, req.user.id]);

    // Mark the report as escalated
    await db.query("UPDATE reports SET is_escalated = TRUE WHERE id = $1", [report_id]);

    await logActivity(req.user.id, "escalation_created", "escalation", id, { report_id, to_area_id, reason });
    res.status(201).json({ success: true, id });
  } catch (e) { 
    console.error("[create escalation]", e);
    res.status(500).json({ error: "Escalation failed" }); 
  }
});

module.exports = router;
