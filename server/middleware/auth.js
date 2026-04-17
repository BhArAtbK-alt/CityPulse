// server/middleware/auth.js
const jwt = require("jsonwebtoken");
const db  = require("../utils/db");
const supabase = require("../utils/supabase");
const SECRET = process.env.JWT_SECRET || "citypulse_secret";

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    return res.status(401).json({ success: false, error: "No token provided" });
  try {
    const decoded = jwt.verify(header.split(" ")[1], SECRET);
    const { rows } = await db.query(
      "SELECT id,username,email,avatar_color,bio,report_count,verified_count,total_upvotes,badge,role FROM users WHERE id = $1",
      [decoded.id]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ success: false, error: "User not found" });

    // Fetch permissions for the user's role
    const { rows: perms } = await db.query(
      "SELECT permission_id FROM role_permissions WHERE role = $1",
      [user.role]
    );
    user.permissions = perms.map(p => p.permission_id);

    req.user = user;
    next();
  } catch {
    res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}

function hasPermission(perm) {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions.includes(perm)) {
      return res.status(403).json({ success: false, error: `Permission denied: ${perm}` });
    }
    next();
  };
}

async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();
  try {
    const decoded = jwt.verify(header.split(" ")[1], SECRET);
    const { rows } = await db.query(
      "SELECT id,username,avatar_color,badge,role FROM users WHERE id = $1",
      [decoded.id]
    );
    const user = rows[0];
    if (user) req.user = user;
  } catch {}
  next();
}

function adminOnly(req, res, next) {
  if (!req.user || !["admin", "super_admin"].includes(req.user.role))
    return res.status(403).json({ success: false, error: "Admin access required" });
  next();
}

function superAdminOnly(req, res, next) {
  if (!req.user || req.user.role !== "super_admin")
    return res.status(403).json({ success: false, error: "Super admin access required" });
  next();
}

// Log admin action to activity_log
async function logActivity(actorId, action, entityType, entityId, meta = {}) {
  try {
    await supabase.from("activity_log").insert({
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      meta,
    });
  } catch (e) {
    console.error("[logActivity]", e.message);
  }
}

// Log critical system changes to audit_logs
async function logAudit(actorId, actionType, entityType, entityId, oldValue, newValue) {
  try {
    await db.query(`
      INSERT INTO audit_logs (actor_id, action_type, entity_type, entity_id, old_value, new_value)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [actorId, actionType, entityType, entityId, 
        oldValue ? JSON.stringify(oldValue) : null, 
        newValue ? JSON.stringify(newValue) : null]);
  } catch (e) {
    console.error("[logAudit]", e.message);
  }
}

module.exports = { authMiddleware, optionalAuth, adminOnly, superAdminOnly, logActivity, logAudit, hasPermission };
