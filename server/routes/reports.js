// server/routes/reports.js
const express  = require("express");
const router   = express.Router();
const { v4: uuidv4 } = require("uuid");
const db       = require("../utils/db");
const supabase = require("../utils/supabase");
const upload   = require("../middleware/upload");
const { authMiddleware, optionalAuth } = require("../middleware/auth");
const { recalculateRankings } = require("../utils/rankings");
const { getWardFromCoords } = require("../utils/wards-logic");
const { isPointInPolygon } = require("../utils/geo");
const fs = require("fs").promises;
const path = require("path");
const sharp = require("sharp");

async function getThreshold() {
  const { rows } = await db.query(`
    SELECT COALESCE(
      (SELECT pin_threshold FROM admin_settings LIMIT 1),
      (SELECT default_pin_threshold FROM system_settings LIMIT 1)
    ) as pin_threshold
  `);
  return rows[0]?.pin_threshold ?? 5;
}

function enrichReport(r) {
  const isAnon = !!r.is_anonymous;
  const author = isAnon ? {
    id: "hidden",
    username: "Concerned Citizen",
    avatar_color: "#64748b", // Neutral grey
    badge: null
  } : {
    id: r.user_id,
    username: r.username,
    avatar_color: r.avatar_color,
    badge: r.badge
  };

  const { username, avatar_color, badge, ...rest } = r;
  return { 
    ...rest, 
    author, 
    pinned_to_map: !!r.pinned_to_map,
    is_anonymous: isAnon
  };
}

// GET /api/reports — public feed
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { category, sort = "newest", limit = 20, offset = 0 } = req.query;
    
    // SQLite count(*) OVER() workaround
    let countSql = `SELECT COUNT(*) as total FROM reports WHERE 1=1`;
    let sql = `
      SELECT r.*, u.username, u.avatar_color, u.badge
      FROM reports r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (category && category !== "all") {
      params.push(category);
      countSql += ` AND category = ?`;
      sql += ` AND r.category = ?`;
    }

    if (sort === "popular") sql += ` ORDER BY r.net_votes DESC, r.created_at DESC`;
    else if (sort === "oldest") sql += ` ORDER BY r.created_at ASC`;
    else sql += ` ORDER BY r.created_at DESC`;

    const { rows: countRows } = await db.query(countSql, params);
    const total = parseInt(countRows[0].total || 0);

    params.push(parseInt(limit));
    sql += ` LIMIT ?`;
    params.push(parseInt(offset));
    sql += ` OFFSET ?`;

    const { rows } = await db.query(sql, params);

    let reports = rows.map(enrichReport);
    
    // Attach userVote and hasMeToo if logged in
    if (req.user && reports.length > 0) {
      const ids = reports.map(r => r.id);
      const placeholders = ids.map(() => "?").join(",");
      
      const [votesRes, meTooRes] = await Promise.all([
        db.query(`SELECT report_id, vote_type FROM votes WHERE user_id = ? AND report_id IN (${placeholders})`, [req.user.id, ...ids]),
        db.query(`SELECT report_id FROM report_me_toos WHERE user_id = ? AND report_id IN (${placeholders})`, [req.user.id, ...ids])
      ]);

      const voteMap = {};
      votesRes.rows.forEach(v => { voteMap[v.report_id] = v.vote_type; });
      
      const meTooSet = new Set(meTooRes.rows.map(m => m.report_id));

      reports = reports.map(r => ({ 
        ...r, 
        userVote: voteMap[r.id] || null,
        hasMeToo: meTooSet.has(r.id)
      }));
    }

    res.json({ success: true, data: reports, total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: "Failed to fetch feed" });
  }
});

// GET /api/reports/map — only pinned reports
router.get("/map", optionalAuth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT r.*, u.username, u.avatar_color, u.badge
      FROM reports r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.pinned_to_map = TRUE
      ORDER BY r.created_at DESC
    `);
    res.json({ success: true, data: rows.map(enrichReport) });
  } catch (e) { res.status(500).json({ success: false, error: "Failed" }); }
});

// GET /api/reports/leaderboard
router.get("/leaderboard", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT id, username, avatar_color, badge, report_count, verified_count, total_upvotes
      FROM users
      WHERE role = 'user'
      ORDER BY total_upvotes DESC
      LIMIT 20
    `);
    const scored = rows.map(u => ({
      ...u, score: u.verified_count*10 + u.total_upvotes*2 + u.report_count
    })).sort((a,b) => b.score - a.score);
    res.json({ success: true, data: scored });
  } catch (e) { res.status(500).json({ success: false, error: "Failed" }); }
});

// GET /api/reports/settings — public threshold
router.get("/settings", async (req, res) => {
  try {
    const threshold = await getThreshold();
    res.json({ success: true, pin_threshold: threshold });
  } catch (e) { res.json({ success: true, pin_threshold: 5 }); }
});

// GET /api/reports/user/:userId
router.get("/user/:userId", optionalAuth, async (req, res) => {
  try {
    const { rows: userRows } = await db.query(
      "SELECT id, username, avatar_color, badge, report_count, verified_count, total_upvotes, bio FROM users WHERE id = ?",
      [req.params.userId]
    );
    const user = userRows[0];
    
    const { rows: reports } = await db.query(`
      SELECT r.*, u.username, u.avatar_color, u.badge
      FROM reports r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `, [req.params.userId]);
    
    res.json({ success: true, data: reports.map(enrichReport), user });
  } catch (e) { res.status(500).json({ success: false, error: "Failed" }); }
});

// GET /api/reports/:id
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const { rows: reportRows } = await db.query(`
      SELECT r.*, u.username, u.avatar_color, u.badge
      FROM reports r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.id = ?
    `, [req.params.id]);
    const report = reportRows[0];
    if (!report) return res.status(404).json({ success: false, error: "Not found" });

    const { rows: comments } = await db.query(`
      SELECT c.*, u.username, u.avatar_color, u.badge
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.report_id = ?
      ORDER BY c.created_at ASC
    `, [req.params.id]);

    const { rows: history } = await db.query(`
      SELECT h.*, u.username as changed_by_name, u.avatar_color as changed_by_avatar, u.role as changed_by_role
      FROM report_status_history h
      LEFT JOIN users u ON h.changed_by = u.id
      WHERE h.report_id = ?
      ORDER BY h.created_at ASC
    `, [req.params.id]);

    let userVote = null;
    let hasMeToo = false;
    if (req.user) {
      const [v, m] = await Promise.all([
        db.query("SELECT vote_type FROM votes WHERE report_id = ? AND user_id = ?", [req.params.id, req.user.id]),
        db.query("SELECT id FROM report_me_toos WHERE report_id = ? AND user_id = ?", [req.params.id, req.user.id])
      ]);
      userVote = v.rows[0]?.vote_type || null;
      hasMeToo = m.rows.length > 0;
    }

    res.json({ success: true, data: { ...enrichReport(report), comments, history, userVote, hasMeToo } });
  } catch (e) { res.status(500).json({ success: false, error: "Failed" }); }
});

// POST /api/reports — create
router.post("/", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    const { title, description, category, latitude, longitude, address, severity_score, is_anonymous } = req.body;
    if (!title || !description)
      return res.status(400).json({ success: false, error: "Title and description required" });

    // --- Toxicity Shield ---
    const profanityRegex = /\b(fuck|shit|bitch|asshole|bastard|idiot|stupid|abuse|fucker)\b/gi;
    if (profanityRegex.test(title) || profanityRegex.test(description)) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ success: false, error: "Keep it civil. Profanity is not allowed." });
    }

    const lat = latitude  ? parseFloat(latitude)  : null;
    const lng = longitude ? parseFloat(longitude) : null;
    const score = severity_score ? parseInt(severity_score) : 5;

    // --- STEP 1: Spam Killer (Deduplication) ---
    // If a report of the same category exists within ~50 meters (0.0005 degrees), merge them.
    if (lat && lng) {
      const { rows: nearby } = await db.query(`
        SELECT id, title FROM reports 
        WHERE category = ? 
        AND ABS(latitude - ?) < 0.0005 
        AND ABS(longitude - ?) < 0.0005
        AND status != 'resolved'
        LIMIT 1
      `, [category || "other", lat, lng]);

      if (nearby.length > 0) {
        // DISK-CRASH FIX: Delete the new file if we are merging into an existing report
        if (req.file) await fs.unlink(req.file.path).catch(() => {});

        const existingId = nearby[0].id;
        // Add to me_too_users (Optional: user's upvote signal)
        try {
          await db.query(`
            INSERT INTO votes (id, report_id, user_id, vote_type) 
            VALUES (?, ?, ?, 'up')
          `, [uuidv4(), existingId, req.user.id]);
          
          await db.query(`
            UPDATE reports SET upvote_count = upvote_count + 1, net_votes = net_votes + 1 WHERE id = ?
          `, [existingId]);
        } catch (err) {
          // User already voted/me-too-ed this
        }

        const { rows: updated } = await db.query("SELECT * FROM reports WHERE id = ?", [existingId]);
        return res.json({ 
          success: true, 
          merged: true, 
          message: "This issue is already being tracked. We've added your voice.",
          data: updated[0] 
        });
      }
    }

    let image_url = null;
    if (req.file) {
      try {
        // High-Detail Compression for Civic Issues
        const compressedBuffer = await sharp(req.file.path)
          .resize(1200, 1200, { 
            fit: "inside", 
            withoutEnlargement: true,
            kernel: sharp.kernel.lanczos3 
          })
          .jpeg({ 
            quality: 80, 
            chromaSubsampling: '4:4:4',
            mozjpeg: true 
          })
          .toBuffer();

        const fileName = `reports/${uuidv4()}.jpg`;
        
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("images")
          .upload(fileName, compressedBuffer, { contentType: "image/jpeg" });

        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage.from("images").getPublicUrl(fileName);
          image_url = publicUrl;
        } else {
          console.error("Supabase Upload Error:", uploadErr.message);
          image_url = `/uploads/${req.file.filename}`;
        }
      } catch (err) {
        console.error("Storage/Compression Error:", err);
        image_url = `/uploads/${req.file.filename}`;
      } finally {
        // ALWAYS delete the local file to prevent disk bloating
        await fs.unlink(req.file.path).catch(() => {});
      }
    }

    const id = uuidv4();

    // Determine Ward and Municipal Area (DATABASE LAYER OPTIMIZED)
    let ward_name = "Unknown", ward_code = "UNKNOWN", area_id = null;
    if (lat && lng) {
      const ward = getWardFromCoords(lat, lng);
      ward_name = ward.ward_name;
      ward_code = ward.ward_code;

      // Single spatial query to find the containing area
      const areaSql = `
        SELECT id FROM municipal_areas 
        WHERE status = 'active' 
        AND ST_Contains(geofence, ST_SetSRID(ST_Point($1, $2), 4326))
        LIMIT 1
      `;
      const { rows: areaRows } = await db.query(areaSql, [lng, lat]);
      if (areaRows.length > 0) area_id = areaRows[0].id;
    }

    const now = new Date();
    const hour = now.getHours();
    const isNightShift = (hour >= 23 || hour < 6);

    // --- STEP 2: SLA & Priority Logic ---
    const priority = score >= 9 ? "emergency" : (score >= 7 ? "high" : (score >= 5 ? "medium" : "low"));
    const baseSla = score >= 9 ? 4 : (score >= 7 ? 12 : (score >= 5 ? 48 : 72));
    const slaHours = isNightShift && score >= 7 ? Math.round(baseSla * 0.75) : baseSla; 
    
    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + slaHours);

    // --- STEP 2.2: THE EMERGENCY BYPASS (Zero-Upvote Auto-Pin) ---
    const isUrgentCategory = ["water", "electricity", "sewage"].includes(category);
    const shouldPin = (score >= 7) || (isNightShift && score >= 6) || (isUrgentCategory && score >= 7);
    const initialStatus = shouldPin ? "verified" : "open";
    const dept = req.body.department || "General";

    await db.query(`
      INSERT INTO reports (
        id, user_id, area_id, title, description, category, department, image_url, 
        latitude, longitude, address, ward_name, ward_code, 
        status, priority, severity_score, due_date, pinned_to_map, is_anonymous, ai_verified, is_night_report
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, req.user.id, area_id, title.trim(), description.trim(), category || "other", dept, image_url, 
      lat, lng, address || "", ward_name, ward_code, 
      initialStatus, priority, score, dueDate.toISOString(), shouldPin, !!is_anonymous, false, isNightShift
    ]);

    const { rows } = await db.query("SELECT * FROM reports WHERE id = ?", [id]);
    const report = rows[0];
    
    recalculateRankings(req.app.locals.io);

    const enriched = { ...report, author: is_anonymous ? { username: "Concerned Citizen" } : req.user };
    
    // Notify everyone
    if (req.app.locals.io) {
      req.app.locals.io.emit("new_report", enriched);
      // Special Emergency Alert for targeted officials
      if (shouldPin) {
        req.app.locals.io.emit("emergency_alert", {
          message: `${isNightShift ? "🌙 NIGHT SHIFT URGENT" : "🚨 URGENT"}: ${category.toUpperCase()} issue in ${ward_name} (${dept} Dept)`,
          report: enriched
        });
        // Targeted departmental ping
        req.app.locals.io.to(`dept_${dept}`).to(`ward_${ward_code}`).emit("urgent_task", enriched);
      }
    }
    res.status(201).json({ success: true, data: enriched });

  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: "Failed to create report" });
  }
});

// POST /api/reports/:id/vote
router.post("/:id/vote", authMiddleware, async (req, res) => {
  try {
    const { type } = req.body;
    if (!["up","down"].includes(type))
      return res.status(400).json({ success: false, error: "Vote type must be up or down" });

    const { rows: reportRows } = await db.query("SELECT * FROM reports WHERE id = ?", [req.params.id]);
    const report = reportRows[0];
    if (!report) return res.status(404).json({ success: false, error: "Not found" });
    if (report.user_id === req.user.id)
      return res.status(400).json({ success: false, error: "Cannot vote on your own report" });

    const { rows: existingRows } = await db.query(
      "SELECT * FROM votes WHERE report_id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    );
    const existing = existingRows[0];

    let upvoteDelta = 0, downvoteDelta = 0, netDelta = 0;

    if (existing) {
      if (existing.vote_type === type) {
        await db.query("DELETE FROM votes WHERE report_id = ? AND user_id = ?", [req.params.id, req.user.id]);
        if (type === "up") { upvoteDelta = -1; netDelta = -1; }
        else { downvoteDelta = -1; netDelta = 1; }
      } else {
        await db.query("UPDATE votes SET vote_type = ? WHERE report_id = ? AND user_id = ?", [type, req.params.id, req.user.id]);
        if (type === "up") { upvoteDelta = 1; downvoteDelta = -1; netDelta = 2; }
        else { upvoteDelta = -1; downvoteDelta = 1; netDelta = -2; }
      }
    } else {
      await db.query("INSERT INTO votes (id, report_id, user_id, vote_type) VALUES (?, ?, ?, ?)", [uuidv4(), req.params.id, req.user.id, type]);
      if (type === "up") { upvoteDelta = 1; netDelta = 1; }
      else { downvoteDelta = 1; netDelta = -1; }
    }

    // Update counts
    const newUpvotes   = (report.upvote_count   || 0) + upvoteDelta;
    const newDownvotes = (report.downvote_count  || 0) + downvoteDelta;
    const newNet       = (report.net_votes       || 0) + netDelta;

    const { rows: uniqRows } = await db.query(
      "SELECT count(*) as count FROM votes WHERE report_id = ? AND vote_type = 'up'",
      [req.params.id]
    );
    const uniq = parseInt(uniqRows[0].count);

    const threshold = await getThreshold();
    const shouldPin = uniq >= threshold && newNet > 0;
    const wasVerified = report.status === "verified";
    const newStatus = shouldPin ? "verified" : (wasVerified ? "pending" : report.status);

    await db.query(`
      UPDATE reports 
      SET upvote_count = ?, downvote_count = ?, net_votes = ?, 
          unique_upvoters = ?, pinned_to_map = ?, status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newUpvotes, newDownvotes, newNet, uniq, shouldPin, newStatus, req.params.id]);

    if (shouldPin && !report.pinned_to_map) {
      await db.query("UPDATE users SET verified_count = verified_count + 1 WHERE id = ?", [report.user_id]);
      const { rows: authorStats } = await db.query("SELECT SUM(upvote_count) as total FROM reports WHERE user_id = ?", [report.user_id]);
      await db.query("UPDATE users SET total_upvotes = ? WHERE id = ?", [parseInt(authorStats[0].total || 0), report.user_id]);
    }

    recalculateRankings(req.app.locals.io);

    const { rows: fullReportRows } = await db.query(`
      SELECT r.*, u.username, u.avatar_color, u.badge
      FROM reports r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.id = ?
    `, [req.params.id]);
    const fullReport = enrichReport(fullReportRows[0]);

    const payload = {
      reportId: req.params.id, net_votes: newNet,
      upvote_count: newUpvotes, downvote_count: newDownvotes,
      unique_upvoters: uniq, pinned_to_map: !!shouldPin,
      status: newStatus,
      report: fullReport
    };
    if (req.app.locals.io) req.app.locals.io.emit("vote_update", payload);
    res.json({ success: true, ...payload, userVote: existing?.vote_type === type ? null : type });
  } catch (e) { console.error(e); res.status(500).json({ success: false, error: "Vote failed" }); }
});

// POST /api/reports/:id/comments
router.post("/:id/comments", authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ success: false, error: "Content required" });

    const id = uuidv4();
    await db.query(`
      INSERT INTO comments (id, report_id, user_id, content)
      VALUES (?, ?, ?, ?)
    `, [id, req.params.id, req.user.id, content.trim()]);

    const { rows } = await db.query("SELECT * FROM comments WHERE id = ?", [id]);
    const comment = rows[0];
    await db.query("UPDATE reports SET comment_count = comment_count + 1 WHERE id = ?", [req.params.id]);

    const enriched = { ...comment, username: req.user.username, avatar_color: req.user.avatar_color, badge: req.user.badge };
    if (req.app.locals.io) req.app.locals.io.emit("new_comment", { reportId: req.params.id, comment: enriched });
    res.status(201).json({ success: true, data: enriched });
  } catch (e) { console.error(e); res.status(500).json({ success: false, error: "Comment failed" }); }
});

// DELETE /api/reports/:id — Delete own report
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT user_id, image_url, is_legal_hold FROM reports WHERE id = ?", [req.params.id]);
    const report = rows[0];
    if (!report) return res.status(404).json({ success: false, error: "Report not found" });

    if (report.is_legal_hold) {
      return res.status(403).json({ success: false, error: "This report is under Legal Hold and cannot be deleted." });
    }

    // Only the owner or a super_admin can delete
    if (report.user_id !== req.user.id && req.user.role !== "super_admin") {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    // 1. Delete from Storage if it's a Supabase URL
    if (report.image_url && report.image_url.includes("supabase")) {
      const fileName = report.image_url.split("/").pop();
      await supabase.storage.from("images").remove([`reports/${fileName}`]).catch(() => {});
    }

    // 2. Delete from Database
    await db.query("DELETE FROM reports WHERE id = ?", [req.params.id]);
    
    recalculateRankings(req.app.locals.io);
    
    if (req.app.locals.io) req.app.locals.io.emit("report_deleted", req.params.id);
    
    res.json({ success: true, message: "Report deleted successfully" });
  } catch (e) {
    res.status(500).json({ success: false, error: "Delete failed" });
  }
});

// POST /api/reports/:id/me-too
router.post("/:id/me-too", authMiddleware, async (req, res) => {
  try {
    const { rows: existing } = await db.query(
      "SELECT id FROM report_me_toos WHERE report_id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    );

    if (existing.length > 0) {
      await db.query("DELETE FROM report_me_toos WHERE report_id = ? AND user_id = ?", [req.params.id, req.user.id]);
      res.json({ success: true, active: false });
    } else {
      await db.query("INSERT INTO report_me_toos (id, report_id, user_id) VALUES (?, ?, ?)", [uuidv4(), req.params.id, req.user.id]);
      res.json({ success: true, active: true });
    }
  } catch (e) { res.status(500).json({ success: false, error: "Action failed" }); }
});

module.exports = router;
