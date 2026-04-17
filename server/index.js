// server/index.js
require("dotenv").config();
const dns = require("node:dns");

// 1. Force IPv4 for stable database/API connections
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

const express = require("express");
const http    = require("http");
const { Server } = require("socket.io");
const cors    = require("cors");
const path    = require("path");
const rateLimit = require("express-rate-limit");
const cron = require("node-cron");
const db = require("./utils/db");

// Routes
const authRouter    = require("./routes/auth");
const reportsRouter = require("./routes/reports");
const adminRouter   = require("./routes/admin");
const superAdminRouter = require("./routes/superAdmin");

const app = express();
const httpServer = http.createServer(app);

const PORT       = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// 2. Socket.io Setup
const io = new Server(httpServer, {
  cors: { 
    origin: [CLIENT_URL, "http://localhost:5173", "http://127.0.0.1:5173"], 
    methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
    credentials: true
  },
  allowEIO3: true
});
app.locals.io = io; // Make accessible to routes

// 3. Global Middlewares
app.set('trust proxy', 1);
app.use(cors({ origin: CLIENT_URL, methods: ["GET", "POST", "PATCH", "DELETE", "PUT"], credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health Check (Always available)
app.get("/api/health", (_, res) => res.json({ status: "ok" }));

// 4. Rate Limiters (Professional Configuration)
const securityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Security limit reached. Please wait 15 minutes." }
});

const feedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: { error: "Browsing limit reached." }
});

const reportCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 500,
  message: { error: "Reporting limit reached. Take a break, citizen!" }
});

// 5. Route Mounting
app.use("/api/auth", securityLimiter, authRouter);
app.use("/api/admin", securityLimiter, adminRouter);
app.use("/api/superadmin", securityLimiter, superAdminRouter);

// Special case for reports: POST is restricted, GET is generous
app.use("/api/reports", (req, res, next) => {
  if (req.method === "POST") return reportCreateLimiter(req, res, next);
  return feedLimiter(req, res, next);
}, reportsRouter);

// 6. Automated Maintenance (Cron Jobs)

// SLA Violation Monitoring (Every 15 mins)
cron.schedule("*/15 * * * *", async () => {
  try {
    const sql = `
      SELECT r.id, r.title, r.category, ma.name as area_name, ma.threshold_config
      FROM reports r
      JOIN municipal_areas ma ON r.area_id = ma.id
      WHERE r.status != 'resolved' 
      AND r.is_escalated = FALSE
      AND ma.status = 'active'
      AND (r.created_at + (COALESCE((ma.threshold_config->>r.category)::int, 72) || ' hours')::interval) < NOW()
    `;
    const { rows: overdue } = await db.query(sql);
    if (overdue.length > 0) {
      console.log(`[SLA] Escalating ${overdue.length} reports...`);
      for (const r of overdue) {
        await db.query("UPDATE reports SET is_escalated = TRUE WHERE id = $1", [r.id]);
        io.emit("sla_breach", { 
          reportId: r.id, 
          message: `🚨 SLA BREACH: ${r.category.toUpperCase()} in ${r.area_name} exceeded threshold!`,
          category: r.category
        });
      }
    }
  } catch (err) { console.error("[SLA Cron Error]", err); }
});

// Temp File Cleanup (Every hour)
cron.schedule("0 * * * *", async () => {
  try {
    const uploadDir = path.join(__dirname, "uploads");
    const fs = require("fs").promises;
    const files = await fs.readdir(uploadDir);
    const now = Date.now();
    for (const file of files) {
      if (file === ".gitkeep") continue;
      const filePath = path.join(uploadDir, file);
      const stats = await fs.stat(filePath);
      if (now - stats.mtimeMs > 3600000) {
        await fs.unlink(filePath).catch(() => {});
      }
    }
  } catch (err) { console.error("[Cleanup Error]", err); }
});

// 7. Error Handling
app.use((err, req, res, next) => {
  console.error("[Fatal Error]", err.message);
  res.status(err.status || 500).json({ success: false, error: err.message || "Internal Server Error" });
});

// 8. Socket Events
io.on("connection", socket => {
  console.log(`[Socket] +Connected: ${socket.id}`);
  socket.on("disconnect", () => console.log(`[Socket] -Disconnected: ${socket.id}`));
});

// 9. Startup
httpServer.listen(PORT, () => {
  console.log(`\n🚀 CityPulse v3 (NON-AI) on port :${PORT}\n✅ Supabase Bridge Ready\n`);
});
