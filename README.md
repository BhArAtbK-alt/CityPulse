# 🏙️ CityPulse — Civic Intelligence Platform

> **CityPulse v3.0** is an open-source civic management platform that converts the traditional one-way complaint process into a transparent, gamified, geospatially-aware civic ecosystem. Built for citizens, municipal admins, and a Super Admin tier with strict PostGIS jurisdictional boundaries.

[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL+PostGIS-3ECF8E.svg)](https://supabase.com)

---

## ✨ Features

### 👥 Citizens
- Report civic issues (potholes, water, electricity, garbage, sewage, vandalism)
- GPS location capture + photo upload (compressed with Sharp.js)
- Real-time feed with upvote/downvote system
- Anonymous reporting option
- Vote-based map pinning (configurable threshold)
- Status timeline tracking (Submitted → Verified → In Progress → Resolved)
- Leaderboard with civic score
- SLA breach notifications via Socket.io

### 🏛️ Municipal Admins
- Draw ward boundary (Leaflet polygon editor + Turf.js conflict detection)
- Zone-strict report view (PostGIS `ST_Contains`)
- Status management + distance-verified resolution (must be within 200m of issue)
- Escalation system — send reports to neighboring wards
- SLA monitoring dashboard (14-day trend, category breakdown)
- Per-category SLA configuration

### 👑 Super Admin (God Mode)
- System-wide stats & analytics (8 KPI cards)
- Confirm/reject ward boundary requests
- God-View map — all reports + all zones
- Force-assign orphaned reports
- Legal hold on reports
- Full RBAC permission management
- Audit logs with JSONB diff trail

---

## 🗂️ Project Structure

```
CityPulse/
├── client/               # React 18 + Vite frontend
│   ├── src/
│   │   ├── components/   # PostCard, DetailDrawer, GeofenceMap, etc.
│   │   ├── pages/        # FeedPage, MapPage, AdminDashboard, SuperAdmin
│   │   ├── services/     # API client (axios)
│   │   ├── context/      # AuthContext, SocketContext
│   │   └── utils/        # constants, ward data
│   └── vite.config.js
├── server/               # Node.js + Express backend
│   ├── routes/           # auth, reports, admin, superAdmin
│   ├── middleware/        # authMiddleware, adminOnly, superAdminOnly
│   ├── utils/            # supabase, db (HTTP bridge), geo, rankings
│   └── index.js          # Server entry, cron jobs, Socket.io
├── sql/                  # All Supabase/PostgreSQL SQL files
│   ├── 00_RUN_ALL.sql    # Master orchestration file
│   ├── 01_tables.sql     # 15 core tables
│   ├── 02_permissions.sql# RBAC seeds
│   ├── 03_indexes.sql    # Spatial + performance indexes
│   ├── 04_functions.sql  # exec_sql, check_area_overlap, SLA calc
│   ├── 05_triggers.sql   # 6 automated triggers
│   ├── 06_rls_policies.sql # Row Level Security
│   ├── 07_data_sync.sql  # One-time integrity sync
│   ├── 08_migrations.sql # Safe ALTER migrations
│   ├── 09_storage.sql    # Supabase Storage bucket
│   └── 10_views.sql      # 5 read-only views
└── CityPulse_Analysis.md # Full architecture + roadmap doc
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+
- **Supabase** account (free tier works)
- **npm** 9+

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/CityPulse.git
cd CityPulse
npm run install:all
```

This installs root, server, and client dependencies in one command.

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. In the SQL Editor, run the files in `sql/` **in order** (00 → 10):
   ```
   00_extensions.sql → 01_tables.sql → 02_permissions.sql → 03_indexes.sql
   → 04_functions.sql → 05_triggers.sql → 06_rls_policies.sql → 08_migrations.sql
   → 09_storage.sql → 10_views.sql
   ```
   > **Tip:** Copy the contents of `sql/01_tables.sql` through each file into Supabase SQL Editor.
3. Go to **Storage** → create a public bucket named `images`

### 3. Configure Environment Variables

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
JWT_SECRET=<run: openssl rand -base64 64>
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...your-service-role-key
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.your-project.supabase.co:5432/postgres
ADMIN_SECRET_CODE=your_admin_code
SUPER_ADMIN_CODE=your_super_admin_code
```

> ⚠️ **Never commit `server/.env`** — it's in `.gitignore`

### 4. Run Development Servers

```bash
npm run dev
```

This starts both the Express server (`:5000`) and Vite client (`:5173`) concurrently.

---

## 🔐 Security Architecture

| Layer | Mechanism |
|-------|-----------|
| **Authentication** | Supabase Auth (email/password) + custom JWT (30-day) |
| **RBAC** | `authMiddleware` → `adminOnly` / `superAdminOnly` on every protected route |
| **Spatial isolation** | PostGIS `ST_Contains` — admins only see reports inside their geofence |
| **Distance verification** | Officials must be within 200m of an issue to mark it resolved |
| **Rate limiting** | 3 separate express-rate-limit configs (security, feed, report creation) |
| **Image safety** | Sharp.js compression strips EXIF; uploads go to Supabase Storage CDN |
| **Toxicity shield** | Profanity regex filter on all report titles and descriptions |
| **Legal hold** | DB trigger prevents deletion of reports under legal hold |
| **RLS** | Row Level Security enabled on all 15 tables |
| **Audit trail** | Immutable JSONB diff log for all critical admin actions |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, React Router v6 |
| **Real-Time** | Socket.io |
| **Maps** | Leaflet.js, Turf.js, H3 (Uber hexagons) |
| **Backend** | Node.js, Express.js |
| **Database** | Supabase (PostgreSQL + PostGIS) |
| **Auth** | Supabase Auth + custom JWT |
| **Storage** | Supabase Storage |
| **Image Processing** | Sharp.js (Lanczos3, MozJPEG 80%) |
| **Scheduling** | node-cron (SLA monitor + file cleanup) |

---

## 📊 Database Schema (15 Tables)

`users` · `municipal_areas` · `boundary_proposals` · `reports` · `votes` · `comments` · `escalations` · `activity_log` · `admin_settings` · `admin_notes` · `permissions` · `role_permissions` · `system_settings` · `report_status_history` · `audit_logs`

See [`sql/README.md`](./sql/README.md) for full documentation.

---

## 🌐 Deployment

### Server (Render / Railway / Fly.io)
1. Set all environment variables from `server/.env.example` in your hosting dashboard
2. Deploy the `server/` directory
3. Set `CLIENT_URL` to your production frontend URL

### Client (Vercel / Netlify)
1. Set `VITE_API_URL=https://your-server.render.com/api` in environment variables
2. Deploy the `client/` directory
3. Build command: `npm run build`

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m 'Add: your feature'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](./LICENSE) for details.

---

<div align="center">
Built with ❤️ for smarter cities · CityPulse v3.0
</div>
