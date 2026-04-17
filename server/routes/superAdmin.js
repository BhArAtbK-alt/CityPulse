// server/routes/superAdmin.js — Top-Level Super Admin
const express  = require("express");
const router   = express.Router();
const supabase = require("../utils/supabase");
const db       = require("../utils/db");
const { v4: uuidv4 } = require("uuid");
const { authMiddleware, superAdminOnly, logActivity, logAudit, hasPermission } = require("../middleware/auth");

router.use(authMiddleware, superAdminOnly);
const { isPointInPolygon } = require("../utils/geo");

// ─────────────────────────────────────────────
// SYSTEM-WIDE OVERVIEW STATS
// ─────────────────────────────────────────────
router.get("/stats", hasPermission('GLOBAL_STATS'), async (req, res) => {
  try {
    const results = await Promise.all([
      supabase.from("reports").select("id", { count: "exact", head: true }),
      supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "user"),
      supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "admin"),
      supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "resolved"),
      supabase.from("escalations").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("municipal_areas").select("id", { count: "exact", head: true }).eq("status", "active"),
      db.query("SELECT COUNT(*) as count FROM reports r LEFT JOIN municipal_areas ma ON r.area_id = ma.id WHERE r.area_id IS NULL OR ma.status != 'active'")
    ]);

    const totalReports       = results[0].count || 0;
    const totalCitizens      = results[1].count || 0;
    const totalAdmins         = results[2].count || 0;
    const pendingReports     = results[3].count || 0;
    const resolvedReports    = results[4].count || 0;
    const escalationsPending  = results[5].count || 0;
    const activeAreas        = results[6].count || 0;
    const orphanedReports    = results[7].rows[0].count || 0;

    // Reports by category
    const { data: catData } = await supabase.from("reports").select("category");
    const byCategory = {};
    (catData || []).forEach(r => { byCategory[r.category] = (byCategory[r.category] || 0) + 1; });

    // Reports by status
    const { data: statusData } = await supabase.from("reports").select("status");
    const byStatus = {};
    (statusData || []).forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });

    // Reports last 30 days trend (daily)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: trendData } = await supabase.from("reports").select("created_at").gte("created_at", thirtyDaysAgo);

    const trend30d = {};
    (trendData || []).forEach(r => {
      const day = r.created_at.slice(0, 10);
      trend30d[day] = (trend30d[day] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        total_reports:       totalReports,
        total_citizens:      totalCitizens,
        total_admins:        totalAdmins,
        pending_reports:     pendingReports,
        resolved_reports:    resolvedReports,
        escalations_pending: escalationsPending,
        total_areas:         activeAreas,
        orphaned_reports:    orphanedReports,
        by_category:         byCategory,
        by_status:           byStatus,
        trend_30d:           trend30d,
      },
    });
  } catch (e) {
    console.error("[superadmin stats]", e);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

// GET /api/superadmin/system-settings
router.get("/system-settings", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM system_settings LIMIT 1");
    res.json({ success: true, data: rows[0] });
  } catch (e) { res.status(500).json({ error: "Failed" }); }
});

// PUT /api/superadmin/system-settings
router.put("/system-settings", async (req, res) => {
  try {
    const { default_sla_hours, default_pin_threshold } = req.body;
    const { rows: old } = await db.query("SELECT * FROM system_settings LIMIT 1");
    
    await db.query(`
      UPDATE system_settings 
      SET default_sla_hours = $1, default_pin_threshold = $2, updated_at = NOW()
    `, [default_sla_hours, default_pin_threshold]);
    
    await logAudit(req.user.id, 'SYSTEM_SETTINGS_UPDATE', 'system', null, old[0], req.body);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: "Update failed" }); }
});

// ─────────────────────────────────────────────
// ALL MUNICIPAL AREAS + THEIR ADMINS
// ─────────────────────────────────────────────
router.get("/areas", async (req, res) => {
  try {
    const { rows: areas } = await db.query(`
      SELECT ma.*, ST_AsGeoJSON(ma.geofence)::jsonb as geofence,
             u.username, u.email, u.avatar_color, u.badge
      FROM municipal_areas ma
      LEFT JOIN users u ON ma.admin_id = u.id
      ORDER BY ma.created_at DESC
    `);

    // For each area, count reports
    const areaIds = areas.map(a => a.id);
    if (areaIds.length === 0) return res.json({ success: true, data: [] });

    const placeholders = areaIds.map((_, i) => `$${i + 1}`).join(",");
    const { rows: reportCounts } = await db.query(`
      SELECT area_id, COUNT(*) as count FROM reports 
      WHERE area_id IN (${placeholders}) GROUP BY area_id
    `, areaIds);

    const countMap = {};
    reportCounts.forEach(r => { countMap[r.area_id] = parseInt(r.count); });

    const enriched = areas.map(a => ({
      ...a,
      admin: a.username ? { id: a.admin_id, username: a.username, email: a.email, avatar_color: a.avatar_color, badge: a.badge } : null,
      report_count: countMap[a.id] || 0,
    }));

    res.json({ success: true, data: enriched });
  } catch (e) {
    console.error("[superadmin areas]", e);
    res.status(500).json({ success: false, error: "Failed to fetch areas" });
  }
});

// POST create/update area
router.post("/areas", async (req, res) => {
  try {
    const { name, code, city, state, geofence, color, admin_id, population } = req.body;
    if (!name || !code) return res.status(400).json({ success: false, error: "name and code required" });

    const id = uuidv4();
    const status = admin_id ? 'active' : 'pending';
    const is_confirmed = !!admin_id;

    const sql = `
      INSERT INTO municipal_areas (
        id, name, code, city, state, geofence, color, admin_id, population, status, is_confirmed
      ) VALUES ($1, $2, $3, $4, $5, ST_Multi(ST_GeomFromGeoJSON($6)), $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const { rows } = await db.query(sql, [
      id, name, code.toUpperCase(), city || "", state || "", 
      JSON.stringify(geofence), color || "#ff5a1f", admin_id || null, 
      population || null, status, is_confirmed
    ]);

    await logActivity(req.user.id, "area_create", "area", id, { name, code });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (e) {
    console.error("[area create]", e);
    res.status(500).json({ success: false, error: "Failed to create area" });
  }
});

// PATCH /api/superadmin/areas/:id/confirm
router.patch("/areas/:id/confirm", hasPermission('OFFICIAL_VERIFY'), async (req, res) => {
  try {
    const { rows: areaRows } = await db.query(
      "SELECT requested_by, name, ST_AsGeoJSON(geofence)::jsonb as geofence FROM municipal_areas WHERE id = $1",
      [req.params.id]
    );
    const area = areaRows[0];
    if (!area?.requested_by) return res.status(400).json({ error: "No request pending for this area" });

    const admin_id = area.requested_by;

    // 1. Confirm the area (Set to ACTIVE)
    await db.query(`
      UPDATE municipal_areas 
      SET admin_id = $1, status = 'active', is_confirmed = TRUE, requested_by = NULL, updated_at = NOW()
      WHERE id = $2
    `, [admin_id, req.params.id]);

    // 2. Sync admin_settings with the official geofence
    await db.query(`
      INSERT INTO admin_settings (id, admin_id, area_id, area_name, geofence)
      VALUES ($1, $2, $3, $4, ST_Multi(ST_GeomFromGeoJSON($5)))
      ON CONFLICT (admin_id) DO UPDATE SET area_id = $3, area_name = $4, geofence = ST_Multi(ST_GeomFromGeoJSON($5))
    `, [uuidv4(), admin_id, req.params.id, area.name, JSON.stringify(area.geofence)]);

    await logAudit(req.user.id, 'AREA_CONFIRM', 'area', req.params.id, null, { admin_id, area_name: area.name });
    await logActivity(req.user.id, "area_confirm", "area", req.params.id, { admin_id });
    res.json({ success: true });
  } catch (e) { 
    console.error("[area confirm]", e);
    res.status(500).json({ error: "Confirmation failed" }); 
  }
});

// GET /api/superadmin/global-feed — Everything, everywhere, all at once
router.get("/global-feed", hasPermission('GLOBAL_STATS'), async (req, res) => {
  try {
    const { category, status, limit = 50, offset = 0 } = req.query;
    let sql = `
      SELECT r.*, u.username, u.avatar_color, ma.name as area_name
      FROM reports r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN municipal_areas ma ON r.area_id = ma.id
      WHERE 1=1
    `;
    const params = [];
    if (category) { params.push(category); sql += ` AND r.category = $${params.length}`; }
    if (status)   { params.push(status);   sql += ` AND r.status = $${params.length}`; }

    sql += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const { rows } = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ error: "Global feed failed" }); }
});

// GET /api/superadmin/orphaned-zones — Reports outside any active boundary
router.get("/orphaned-zones", hasPermission('MAP_EDIT'), async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT r.*, u.username, u.avatar_color
      FROM reports r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.area_id IS NULL OR r.area_id NOT IN (SELECT id FROM municipal_areas WHERE status = 'active')
      ORDER BY r.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ error: "Orphaned query failed" }); }
});

router.put("/areas/:id", hasPermission('MAP_EDIT'), async (req, res) => {
  try {
    const { name, code, city, state, geofence, color, admin_id, population, is_active } = req.body;
    
    // CAPTURE OLD STATE FOR AUDIT
    const { rows: oldAreaRows } = await db.query(
      "SELECT *, ST_AsGeoJSON(geofence)::jsonb as geofence FROM municipal_areas WHERE id = $1",
      [req.params.id]
    );
    const oldArea = oldAreaRows[0];

    let sql = "UPDATE municipal_areas SET updated_at = NOW()";
    const params = [];
    
    if (name !== undefined) { params.push(name); sql += `, name = $${params.length}`; }
    if (code !== undefined) { params.push(code.toUpperCase()); sql += `, code = $${params.length}`; }
    if (city !== undefined) { params.push(city); sql += `, city = $${params.length}`; }
    if (state !== undefined) { params.push(state); sql += `, state = $${params.length}`; }
    if (geofence !== undefined) { params.push(JSON.stringify(geofence)); sql += `, geofence = ST_Multi(ST_GeomFromGeoJSON($${params.length}))`; }
    if (color !== undefined) { params.push(color); sql += `, color = $${params.length}`; }
    if (admin_id !== undefined) { params.push(admin_id); sql += `, admin_id = $${params.length}`; }
    if (population !== undefined) { params.push(population); sql += `, population = $${params.length}`; }
    if (is_active !== undefined) { params.push(is_active); sql += `, is_active = $${params.length}`; }

    if (admin_id) { sql += `, status = 'active', is_confirmed = TRUE`; }

    sql += ` WHERE id = $${params.length + 1} RETURNING *`;
    params.push(req.params.id);

    const { rows } = await db.query(sql, params);
    const data = rows[0];
    
    // LOG AUDIT
    await logAudit(req.user.id, 'AREA_UPDATE', 'area', req.params.id, oldArea, req.body);

    // SYNC: If this area has an active admin, sync the changes to their settings too
    if (data.admin_id && (geofence !== undefined || name !== undefined)) {
      let syncSql = "UPDATE admin_settings SET updated_at = NOW()";
      const syncParams = [];
      if (name !== undefined) { syncParams.push(name); syncSql += `, area_name = $${syncParams.length}`; }
      if (geofence !== undefined) { syncParams.push(JSON.stringify(geofence)); syncSql += `, geofence = ST_Multi(ST_GeomFromGeoJSON($${syncParams.length}))`; }
      
      syncSql += ` WHERE area_id = $${syncParams.length + 1}`;
      syncParams.push(req.params.id);
      await db.query(syncSql, syncParams);
    }

    await logActivity(req.user.id, "area_update", "area", req.params.id, req.body);
    res.json({ success: true, data });
  } catch (e) {
    console.error("[area update]", e);
    res.status(500).json({ success: false, error: "Failed to update area" });
  }
});

// ─────────────────────────────────────────────
// ALL MUNICIPAL OFFICIALS (admins)
// ─────────────────────────────────────────────
router.get("/officials", hasPermission('USER_MANAGE'), async (req, res) => {
  try {
    const { rows: admins } = await db.query(`
      SELECT id,username,email,avatar_color,badge,created_at,report_count,verified_count,total_upvotes
      FROM users
      WHERE role IN ('admin', 'super_admin')
      ORDER BY created_at DESC
    `);

    const { rows: settings } = await db.query(`
      SELECT s.admin_id, s.area_name, s.area_id, s.pin_threshold, s.sla_hours, 
             ST_AsGeoJSON(s.geofence)::jsonb as geofence,
             ma.name as official_area_name, ma.code, ma.color
      FROM admin_settings s
      LEFT JOIN municipal_areas ma ON s.area_id = ma.id
    `);

    const settingsMap = {};
    settings.forEach(s => { settingsMap[s.admin_id] = s; });

    const { rows: areaStats } = await db.query(`
      SELECT area_id, 
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE status = 'resolved') as resolved
      FROM reports
      WHERE area_id IS NOT NULL
      GROUP BY area_id
    `);
    
    const statsMap = {};
    areaStats.forEach(s => { statsMap[s.area_id] = s; });

    const enriched = admins.map(a => {
      const s = settingsMap[a.id];
      const stats = s?.area_id ? statsMap[s.area_id] : null;
      return {
        ...a,
        area_name:  s?.official_area_name || s?.area_name || "No zone",
        area_code:  s?.code || null,
        area_color: s?.color || null,
        geofence:   s?.geofence || null,
        sla_hours:  s?.sla_hours || 72,
        total_reports_in_zone:    parseInt(stats?.total || 0),
        resolved_reports_in_zone: parseInt(stats?.resolved || 0),
        resolution_rate: stats?.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0,
      };
    });

    res.json({ success: true, data: enriched });
  } catch (e) {
    console.error("[officials]", e);
    res.status(500).json({ success: false, error: "Failed to fetch officials" });
  }
});

// ─────────────────────────────────────────────
// ALL CITIZENS
// ─────────────────────────────────────────────
router.get("/citizens", async (req, res) => {
  try {
    const { search, sort = "newest", limit = 50, offset = 0 } = req.query;
    let query = supabase.from("users").select("id,username,email,avatar_color,badge,report_count,verified_count,total_upvotes,created_at", { count: "exact" }).eq("role", "user");
    if (search) query = query.ilike("username", `%${search}%`);
    const sortMap = { newest: ["created_at", false], oldest: ["created_at", true], reports: ["report_count", false], upvotes: ["total_upvotes", false] };
    const [col, asc] = sortMap[sort] || sortMap.newest;
    query = query.order(col, { ascending: asc }).range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    const { data, count } = await query;
    res.json({ success: true, data: data || [], total: count || 0 });
  } catch (e) { res.status(500).json({ success: false, error: "Failed" }); }
});

// ─────────────────────────────────────────────
// MAP — God View
// ─────────────────────────────────────────────
router.get("/map", async (req, res) => {
  try {
    const { category, status, priority, area_id } = req.query;
    let reportQ = supabase.from("reports").select("id,title,category,status,priority,latitude,longitude,net_votes,area_id,created_at,users(username,avatar_color)");
    if (category && category !== "all") reportQ = reportQ.eq("category", category);
    if (status   && status   !== "all") reportQ = reportQ.eq("status",   status);
    if (priority && priority !== "all") reportQ = reportQ.eq("priority", priority);
    if (area_id  && area_id  !== "all") reportQ = reportQ.eq("area_id",  area_id);

    const { rows: areas } = await db.query(`
      SELECT id, name, code, color, ST_AsGeoJSON(geofence)::jsonb as geofence, status, admin_id 
      FROM municipal_areas
    `);

    const { data: reportData } = await reportQ;

    const reports = (reportData || []).filter(r => r.latitude && r.longitude).map(r => {
      const { users, ...rest } = r;
      return { ...rest, author: users || null };
    });

    res.json({ success: true, reports, zones: areas });
  } catch (e) { 
    console.error("[superadmin map]", e);
    res.status(500).json({ error: "Map failed" }); 
  }
});

// ─────────────────────────────────────────────
// SYSTEM-WIDE ACTIVITY LOG
// ─────────────────────────────────────────────
router.get("/activity", async (req, res) => {
  try {
    const { limit = 50, actor_id } = req.query;
    let q = supabase.from("activity_log").select("*, users!actor_id(username,avatar_color,role)").order("created_at", { ascending: false }).limit(parseInt(limit));
    if (actor_id) q = q.eq("actor_id", actor_id);
    const { data } = await q;
    res.json({ success: true, data: data || [] });
  } catch (e) { res.status(500).json({ error: "Activity failed" }); }
});

// ─────────────────────────────────────────────
// ALL ESCALATIONS
// ─────────────────────────────────────────────
router.get("/escalations", async (req, res) => {
  try {
    const { status } = req.query;
    let q = supabase.from("escalations").select("*, reports(id,title,category,status), municipal_areas!from_area_id(name,code), municipal_areas!to_area_id(name,code), users!escalated_by(username,avatar_color)").order("created_at", { ascending: false });
    if (status && status !== "all") q = q.eq("status", status);
    const { data } = await q;
    res.json({ success: true, data: data || [] });
  } catch (e) { res.status(500).json({ error: "Escalations failed" }); }
});

// Force-resolve an escalation
router.patch("/escalations/:id", async (req, res) => {
  try {
    const { status, resolution_note } = req.body;
    const { data } = await supabase.from("escalations").update({ status, resolution_note, resolved_by: req.user.id, updated_at: new Date().toISOString() }).eq("id", req.params.id).select().single();
    await logActivity(req.user.id, "escalation_force_resolve", "escalation", req.params.id, { status });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ error: "Failed" }); }
});

// ─────────────────────────────────────────────
// PROMOTE / DEMOTE USER ROLE
// ─────────────────────────────────────────────
router.patch("/users/:id/role", async (req, res) => {
  try {
    const { role } = req.body;
    if (!["user","admin","super_admin"].includes(role)) return res.status(400).json({ success: false, error: "Invalid role" });
    const { data } = await supabase.from("users").update({ role }).eq("id", req.params.id).select().single();
    await logActivity(req.user.id, "role_change", "user", req.params.id, { role });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: "Failed" }); }
});

// ─────────────────────────────────────────────
// FORCE ASSIGN REPORT TO AREA
// ─────────────────────────────────────────────
router.patch("/reports/:id/assign", hasPermission('MAP_EDIT'), async (req, res) => {
  try {
    const { area_id } = req.body;
    if (!area_id) return res.status(400).json({ error: "area_id required" });
    
    await db.query("UPDATE reports SET area_id = $1, is_escalated = FALSE WHERE id = $2", [area_id, req.params.id]);
    await logActivity(req.user.id, "force_assign", "report", req.params.id, { area_id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: "Assign failed" }); }
});

// ─────────────────────────────────────────────
// LEGAL HOLD TOGGLE
// ─────────────────────────────────────────────
router.patch("/reports/:id/legal-hold", hasPermission('REPORT_DELETE'), async (req, res) => {
  try {
    const { is_legal_hold } = req.body;
    await db.query("UPDATE reports SET is_legal_hold = $1 WHERE id = $2", [!!is_legal_hold, req.params.id]);
    await logAudit(req.user.id, is_legal_hold ? 'LEGAL_HOLD_ENABLE' : 'LEGAL_HOLD_DISABLE', 'report', req.params.id, null, { is_legal_hold });
    res.json({ success: true, is_legal_hold });
  } catch (e) { res.status(500).json({ error: "Failed to toggle legal hold" }); }
});

module.exports = router;
