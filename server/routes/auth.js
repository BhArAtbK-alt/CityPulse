// server/routes/auth.js
const express = require("express");
const router  = express.Router();
const jwt     = require("jsonwebtoken");
const db      = require("../utils/db");
const supabase = require("../utils/supabase");
const { authMiddleware } = require("../middleware/auth");

const SECRET   = process.env.JWT_SECRET || "citypulse_secret";
const ADMIN_CODE = process.env.ADMIN_SECRET_CODE || "Karma";
const SUPER_ADMIN_CODE = process.env.SUPER_ADMIN_CODE || "SuperKarma";
const COLORS   = ["#ff5a1f","#00c9a7","#fbbf24","#a78bfa","#60a5fa","#f87171","#34d399","#fb923c"];
const sign     = u => jwt.sign({ id: u.id, username: u.username, role: u.role }, SECRET, { expiresIn: "30d" });

async function createUser(email, password, username, role, res) {
  // Step 1: Pre-check username in PG bridge
  const { rows: existingUsername } = await db.query("SELECT id FROM users WHERE username = $1", [username]);
  if (existingUsername.length > 0) {
    return res.status(409).json({ success: false, error: "Username already taken" });
  }

  // Step 2: Create auth user
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email: email.toLowerCase(),
    password,
  });

  if (authErr) {
    if (authErr.message.toLowerCase().includes("already"))
      return res.status(409).json({ success: false, error: "Email already registered. Try a different username/email combo." });
    return res.status(400).json({ success: false, error: authErr.message });
  }

  const userId = authData.user.id;

  // Step 3: Insert user profile into PG bridge
  const avatar_color = COLORS[Math.floor(Math.random() * COLORS.length)];
  try {
    const { error: profileErr } = await db.query(`
      INSERT INTO users (id, username, email, avatar_color, role)
      VALUES ($1, $2, $3, $4, $5)
    `, [userId, username.trim(), email.toLowerCase(), avatar_color, role]);

    if (profileErr) throw profileErr;

    const { rows } = await db.query(`
      SELECT id, username, email, avatar_color, bio, report_count, verified_count, total_upvotes, badge, role 
      FROM users WHERE id = $1
    `, [userId]);
    const user = rows[0];
    return { user, token: sign(user) };
  } catch (err) {
    console.error("[createUser profile]", err);
    // Cleanup if possible
    await supabase.auth.admin.deleteUser(userId).catch(() => {});
    return res.status(500).json({ success: false, error: "Profile creation failed. Please try again." });
  }
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ success: false, error: "All fields required" });
    if (username.trim().length < 3)
      return res.status(400).json({ success: false, error: "Username min 3 characters" });
    if (password.length < 6)
      return res.status(400).json({ success: false, error: "Password min 6 characters" });

    const result = await createUser(email, password, username.trim(), "user", res);
    if (result && result.user) {
      res.status(201).json({ success: true, token: result.token, user: result.user });
    }
  } catch (e) {
    console.error("[register]", e);
    res.status(500).json({ success: false, error: "Registration failed" });
  }
});

// POST /api/auth/admin/register
router.post("/admin/register", async (req, res) => {
  try {
    const { username, email, password, secret_code } = req.body;
    const normalizedEmail = email?.toLowerCase().trim();
    
    let role = "admin";
    if (secret_code === SUPER_ADMIN_CODE) {
      // Strict Single Account Rule: Check if any super_admin already exists
      const { rows: superExists } = await db.query("SELECT id FROM users WHERE role = 'super_admin'");
      if (superExists.length > 0) {
        return res.status(403).json({ success: false, error: "The single Super Admin account already exists. Please use login." });
      }

      role = "super_admin";
    } else if (secret_code !== ADMIN_CODE) {
      return res.status(403).json({ success: false, error: "Invalid admin secret code" });
    }
    
    if (!username || !email || !password)
      return res.status(400).json({ success: false, error: "All fields required" });
    if (password.length < 6)
      return res.status(400).json({ success: false, error: "Password min 6 characters" });

    const result = await createUser(email, password, username.trim(), role, res);
    if (result && result.user) {
      res.status(201).json({ success: true, token: result.token, user: result.user });
    }
  } catch (e) {
    console.error("[admin register]", e);
    res.status(500).json({ success: false, error: "Registration failed" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ success: false, error: "Username and password required" });

    // Step 1: Get email from users table using username
    const { rows: userRows } = await db.query("SELECT email FROM users WHERE username = $1", [username.trim()]);
    if (userRows.length === 0) {
      return res.status(401).json({ success: false, error: "Invalid username or password" });
    }
    const { email } = userRows[0];

    // Step 2: Sign in with Supabase using email
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password,
    });

    if (authErr) {
      console.error("[Auth Error]", authErr.message);
      return res.status(401).json({ success: false, error: "Invalid username or password" });
    }

    const { rows } = await db.query(`
      SELECT id, username, email, avatar_color, bio, report_count, verified_count, total_upvotes, badge, role 
      FROM users WHERE id = $1
    `, [authData.user.id]);
    
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: "Auth successful, but no matching profile found in 'users' table. Please re-register." 
      });
    }

    res.json({ success: true, token: sign(user), user });
  } catch (e) {
    console.error("[login]", e);
    res.status(500).json({ success: false, error: "Login failed" });
  }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: "Email required" });

    await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
      redirectTo: `${process.env.CLIENT_URL}/reset-password`,
    });
    res.json({ success: true, message: "If that email exists, a reset link has been sent." });
  } catch (e) {
    res.status(500).json({ success: false, error: "Failed to send reset email" });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { access_token, new_password } = req.body;
    if (!access_token || !new_password)
      return res.status(400).json({ success: false, error: "Token and new password required" });
    if (new_password.length < 6)
      return res.status(400).json({ success: false, error: "Password min 6 characters" });

    const { data: { user }, error: verifyErr } = await supabase.auth.getUser(access_token);
    if (verifyErr || !user)
      return res.status(400).json({ success: false, error: "Invalid or expired reset link" });

    const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
      password: new_password,
    });
    if (updateErr)
      return res.status(400).json({ success: false, error: "Reset failed: " + updateErr.message });

    res.json({ success: true, message: "Password updated successfully" });
  } catch (e) {
    res.status(500).json({ success: false, error: "Reset failed" });
  }
});

// GET /api/auth/me
router.get("/me", authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
