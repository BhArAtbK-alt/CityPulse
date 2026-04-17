# 🏙️ CityPulse NON-AI — Complete System Analysis
> Version 3.0 (Cloud Edition) | Full Architecture, Feature Inventory & Upgrade Roadmap

---

## 🧠 Core Philosophy

CityPulse is a **civic intelligence platform** that converts the traditional, one-way complaint-filing process into a **transparent, gamified, geospatially-aware civic ecosystem**. It operates across 3 distinct user tiers — Citizens, Municipal Admins, and a Super Admin — each with isolated jurisdictional views, enforced by PostGIS spatial queries at the database layer.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 (Vite), React Router v6 |
| **Real-Time** | Socket.io (client + server) |
| **Maps** | Leaflet.js + Turf.js (polygon intersection) |
| **Styling** | Vanilla CSS, Custom Dark Mode Design System |
| **Backend** | Node.js + Express.js |
| **Database** | Supabase (PostgreSQL + PostGIS) |
| **Auth** | Supabase Auth (JWT) + Custom JWT signing (30-day tokens) |
| **Storage** | Supabase Storage (compressed image hosting) |
| **Image Processing** | Sharp.js (Lanczos3 resize, MozJPEG compression) |
| **Scheduling** | node-cron (SLA monitor + file cleanup) |
| **Rate Limiting** | express-rate-limit (3 separate limiters) |

---

## 🗄️ Database Schema (11 Tables)

| Table | Purpose |
|---|---|
| `users` | All users — role: `user` / `admin` / `super_admin` |
| `municipal_areas` | Ward/zone polygons (PostGIS `MultiPolygon`) with lifecycle status |
| `boundary_proposals` | Pending admin boundary change requests |
| `reports` | Civic issue reports — rich schema with spatial geom, SLA, votes |
| `votes` | Up/down votes per report per user (unique constraint) |
| `comments` | User comments on reports; `is_official` flag for admin remarks |
| `escalations` | Cross-ward escalation records (from/to area, status, resolution) |
| `activity_log` | JSONB meta audit trail for all admin actions |
| `admin_settings` | Per-admin config: SLA hours, pin threshold, geofence, area link |
| `admin_notes` | Internal admin annotations on reports |
| `permissions` + `role_permissions` | RBAC permission seeds (7 permissions) |
| `system_settings` | Global defaults: `default_sla_hours`, `default_pin_threshold` |
| `audit_logs` | Immutable diff log for critical changes (old/new JSONB values) |

---

## ⚙️ Automated DB Logic

### Triggers
| Trigger | Event | Effect |
|---|---|---|
| `tr_sync_report_geom` | INSERT/UPDATE lat/lng on `reports` | Auto-generates `location_geom` PostGIS Point |
| `tr_update_report_count` | INSERT/DELETE on `reports` | Increments/decrements `users.report_count` |
| `tr_boundary_shift` | UPDATE `geofence` on `municipal_areas` | Re-assigns unresolved reports to new containing areas; marks orphans |

### Functions
| Function | Purpose |
|---|---|
| `check_area_overlap(geom, exclude_id)` | Returns conflicting active areas for spatial validation |
| `exec_sql(text)` | Dynamic query bridge (SELECT/DML) for Node.js service role |
| `handle_boundary_shift()` | Core re-assignment logic called by boundary trigger |

### Cron Jobs (server/index.js)
| Job | Schedule | Action |
|---|---|---|
| **SLA Monitor** | Every 15 minutes | Finds overdue unresolved reports; sets `is_escalated = TRUE`; emits `sla_breach` Socket event |
| **File Cleanup** | Every hour | Deletes local temp upload files older than 1 hour |

---

## 🔑 Authentication & RBAC

- **Registration flows**: `/api/auth/register` (citizen), `/api/auth/admin/register` (admin/super_admin via secret codes)
- **Singleton Super Admin**: Only ONE `super_admin` can exist; enforced at registration
- **Login**: Username → email lookup → Supabase `signInWithPassword` → custom JWT (30d)
- **Password Reset**: Supabase email link → `/reset-password` page → `admin.updateUserById`
- **JWT**: Verified on every protected request; full user profile + permissions loaded from DB
- **7 Permissions** seeded: `MAP_EDIT`, `USER_MANAGE`, `REPORT_DELETE`, `OFFICIAL_VERIFY`, `SLA_CONFIG`, `GLOBAL_STATS`, `ACTIVITY_VIEW`
- **`hasPermission(perm)` middleware**: Route-level fine-grained guard (used in superAdmin routes)

---

## 📱 Frontend Structure (Client)

### Routing Logic (App.jsx Shell)
- `super_admin` → redirect all to `/superadmin/*` → `SuperAdminDashboard`
- `admin` → redirect all to `/admin/*` → `AdminDashboard`
- `user` / guest → standard public Shell with TopBar + BottomNav + modal overlays

### Pages & Components

#### Citizen-Facing Pages
| Page | File | Features |
|---|---|---|
| **Feed** | `FeedPage.jsx` | Real-time report feed, category/sort filters, skeleton loaders, infinite scroll, live Socket banner |
| **Map** | `MapPage.jsx` | Leaflet map with pinned reports as markers |
| **Leaderboard** | `LeaderboardPage.jsx` | Top 20 citizens ranked by score formula |
| **Profile** | `ProfilePage.jsx` | User stats, own report list |
| **Auth** | `AuthPage.jsx` | Login/Register modal with admin/super_admin secret code support |
| **Reset Password** | `ResetPasswordPage.jsx` | Token-based password reset |

#### Shared Components
| Component | Purpose |
|---|---|
| `TopBar` | App header with create button |
| `BottomNav` | Mobile nav (Feed/Map/Create/Leaderboard/Profile) |
| `CreateModal` | Report creation form: title, desc, category, photo, GPS, severity slider, anonymous toggle |
| `PostCard` | Single report card: author, image, votes, category badge, PIN indicator |
| `DetailDrawer` | Slide-in panel for report detail + comments |
| `GeofenceMap` | Leaflet-based polygon draw/view for admin geofence setup |
| `Avatar` | Color-coded initials avatar |

#### Admin Dashboard (`/admin/*`)
| Tab | File | Features |
|---|---|---|
| **Overview** | `AdminOverview.jsx` | Area stats: total/pending/resolved/escalated, 30-day trend, category breakdown |
| **Zone Map** | `AdminMapView.jsx` | Leaflet map with reports in jurisdiction + neighboring zones |
| **Requests** | `AdminReports.jsx` | Filtered report table; status update, delay, resolve-with-photo actions |
| **Escalations** | `AdminEscalations.jsx` | Incoming/Outgoing escalations; accept/reject with note |
| **Boundaries** | `AdminGeofence.jsx` | Draw/edit ward polygon; spatial overlap validation; submit for SA review |
| **Settings** | `AdminSettings.jsx` | SLA hours, pin threshold, per-category thresholds, auto-escalate toggle |

> **Admin Activation Flow**: New admin → Draw boundary → Request area → SuperAdmin confirms → `status: active` → Dashboard unlocks

#### SuperAdmin Dashboard (`/superadmin/*`)
| Tab | File | Features |
|---|---|---|
| **Overview** | `SAOverview.jsx` | 8 KPI cards, 14-day bar trend, category breakdown, status distribution bar, activity log |
| **Areas** | `SAAreas.jsx` | All municipal areas; confirm pending, edit, suspend; create new area |
| **Map** | `SAMap.jsx` | God-View: all reports + all zone polygons with filters |
| **Officials** | `SAOfficials.jsx` | All admins with zone stats, resolution rate, promote/demote |
| **Citizens** | `SACitizens.jsx` | All users with search/sort, role change |
| **Escalations** | `SAEscalations.jsx` | All system escalations, force-resolve |
| **Global Inbox** | `SAGlobalInbox.jsx` | All reports across all areas with category/status filters |

---

## 🌟 Feature Inventory — All Current Features

### 🟠 Citizen Features
1. **Public registration** (email + username + password)
2. **Login** (username-based, email looked up internally)
3. **Forgot/Reset password** (email link via Supabase)
4. **Report creation** — title, description, category, department, GPS coordinates, severity score (1–10), optional photo, anonymous toggle
5. **Smart deduplication** — reports within ~50m of same category merged; submitter's vote added
6. **Image compression** — Sharp.js Lanczos3 resize to 1200px, MozJPEG 80% quality
7. **Supabase Storage upload** with local fallback
8. **Emergency auto-pin** — severity ≥7, urgent categories (water/electricity/sewage), or night shift severity ≥6 → auto-verified + pinned to map
9. **Night-shift detection** — Reports between 11 PM–6 AM flagged `is_night_report`; SLA reduced by 25%
10. **SLA assignment** — Based on severity: emergency=4h, high=12h, medium=48h, low=72h
11. **Public feed** — Paginated (15 per page), sort by: newest/popular/oldest, filter by category
12. **Real-time feed updates** — Socket `new_report` events inject new cards live
13. **Vote system** — Up/down votes, toggle (remove vote), cannot self-vote
14. **Vote-based pinning** — Unique upvoters ≥ threshold (configurable, default 5) → report pinned to map
15. **Comment system** — Authenticated comments on reports
16. **Map view** — Leaflet map showing pinned reports
17. **Leaderboard** — Score = verified_count×10 + total_upvotes×2 + report_count, Top 20
18. **Profile page** — Own report history, civic stats
19. **Report deletion** — Own reports (or Super Admin)
20. **Anonymous reporting** — Author shown as "Concerned Citizen" with neutral avatar
21. **Status notifications** — Toast when own report status changes (Socket)
22. **"Toxicity Shield"** — Profanity regex filter on title/description

### 🛡️ Municipal Admin Features
1. **Admin registration** with `ADMIN_SECRET_CODE`
2. **Geofence drawing** — Interactive Leaflet polygon editor
3. **Area request** — Submit polygon to SuperAdmin for confirmation
4. **Spatial overlap check** — PostGIS `check_area_overlap()` prevents boundary conflicts
5. **Jurisdiction activation** — Dashboard locked until SuperAdmin confirms area
6. **Zone-strict report view** — Only sees reports whose `location_geom` is inside their zone (PostGIS `ST_Contains`)
7. **Report status updates** — pending → verified → in_progress → resolved
8. **Distance-verified resolution** — Official must be within 200m (PostGIS geography distance) to mark resolved; requires after-photo
9. **SLA delay extension** — Admin can extend deadline with hours + reason; logged in admin_notes
10. **Escalation management** — Send reports to neighboring ward; receive and accept/reject incoming escalations
11. **Admin overview stats** — Total, pending, in_progress, resolved, escalated, delayed, avg resolution hours
12. **30-day trend chart** — Daily report count for own zone
13. **Category breakdown** — Distribution by issue type
14. **Zone map view** — Own reports + neighboring zones on Leaflet
15. **Activity log** — Own actions + area-related events
16. **Settings page** — SLA hours, pin threshold, per-category SLA config, auto-escalate toggle
17. **Admin notes** — Internal notes/annotations on reports
18. **Boundary proposals** — Request boundary changes; triggers `BOUNDARY_CHANGE_REQUEST` audit
19. **Neighboring areas view** — See adjacent active zones

### 👑 Super Admin (God-Mode) Features
1. **Super Admin registration** with `SUPER_ADMIN_CODE` (singleton rule)
2. **System-wide stats** — Total reports, citizens, admins, areas, pending/resolved, escalations pending, orphaned reports
3. **14-day trend chart + category breakdown + status distribution bar**
4. **All municipal areas CRUD** — Create, edit (name, code, city, state, color, population, geofence, admin), suspend
5. **Area confirmation** — Approve pending admin area requests → sets `status: active`
6. **God View map** — ALL reports + ALL zone polygons with category/status/priority/area filters
7. **Officials management** — View all admins, resolution rates, promote/demote roles
8. **Citizens management** — Search/sort all citizens, change roles
9. **Global report inbox** — All reports across all areas, filterable
10. **Orphaned report handler** — View reports not in any active zone; force-assign to area
11. **Force-assign reports** — Override report's area assignment
12. **Escalation oversight** — View all inter-ward escalations, force-resolve any
13. **System settings** — Global `default_sla_hours` and `default_pin_threshold`
14. **Audit logs** — Immutable JSONB diff trail for: BOUNDARY_CHANGE, AREA_CONFIRM, AREA_UPDATE, SYSTEM_SETTINGS_UPDATE
15. **Activity log** — Full system-wide action stream
16. **Boundary shift auto-reassignment** — DB trigger re-assigns reports when geofence changes
17. **RBAC permission system** — 7 fine-grained permissions, `hasPermission` middleware guards
18. **Supabase audit sync** — Area updates sync admin_settings geofence automatically

---

## 🚀 UPGRADE ROADMAP — Suggested Features by Tier

---

### 👑 SUPER ADMIN — New & Modified Features

#### 🆕 New Features

| # | Feature | Description |
|---|---|---|
| 1 | **AI-Powered Report Triage Dashboard** | Integrate a small NLP model or LLM API to auto-classify incoming reports, suggest category corrections, flag duplicate descriptions across far locations, and assign initial priority. The `ai_verified` field already exists — wire it to actual AI output. |
| 2 | **Multi-Super-Admin Support with Permission Delegation** | Lift the singleton limitation. Allow the primary super_admin to create "deputy" super admins with selective permissions (e.g., can manage areas but not demote users). Add a `delegated_by` field to `role_permissions`. |
| 3 | **City Health Score Dashboard** | Compute a rolling "City Health Index" per area: weighted formula of resolution rate, SLA compliance rate, escalation rate, citizen satisfaction. Display as a league table and map heatmap. |
| 4 | **SLA Breach Command Center** | Dedicated real-time tab showing all reports currently in SLA breach, grouped by area, with 1-click force-assign to a neighbor zone or super-admin override status change. |
| 5 | **Cross-Ward Heatmap Analytics** | PostGIS-powered density heatmap overlaid on the God-View map. Toggle by category (e.g., where are pothole clusters?). Use ST_KMeans or a client-side Leaflet.heat plugin. |
| 6 | **Admin Performance Scorecard** | Monthly/weekly KPI report per admin: avg resolution time, SLA compliance %, escalation frequency, citizen satisfaction score. Email-ready PDF export. |
| 7 | **Broadcast Notifications** | Push a system-wide or zone-targeted announcement to all connected clients via Socket. E.g., "Water outage scheduled 2pm–5pm in Zone B." |
| 8 | **Boundary Conflict Resolution Wizard** | When two pending zone requests overlap, show a side-by-side Leaflet comparison and let SA trim one boundary, then approve both with a single action. |
| 9 | **Report Trend Forecasting** | Use the 30-day historical data to project next-7-day expected volumes per category per area. Simple linear regression or moving average. Warn SA if a spike is forecast. |
| 10 | **Audit Log Search & Export** | Full-text searchable audit log with date range filters, actor filter, action type filter, and CSV/JSON export. Currently audit_logs is write-only from the UI. |
| 11 | **Area Hierarchy / Sub-Zones** | Allow a `parent_area_id` on `municipal_areas` so a mega-zone (e.g., "North District") contains child wards. SA can assign different admins to sub-zones. |
| 12 | **Emergency Declare Mode** | SA can declare an "emergency" for an area (flood, fire). All new reports in that area auto-escalate, SLAs halved, and a banner is shown on the citizen feed for that zone. |

#### 🔧 Modified/Upgraded Existing Features

| # | Current Feature | Upgrade |
|---|---|---|
| M1 | Global Stats (8 cards) | Add: avg resolution time city-wide, SLA compliance % city-wide, top-performing ward, worst-performing ward. Use color-coded delta indicators (▲▼ vs last week). |
| M2 | God-View Map | Add: Choropleth coloring of zones by resolution rate. Clicking a zone polygon shows a pop-up summary (pending count, last activity, admin name). |
| M3 | Officials Table | Add: "Last active" timestamp, "SLA breach rate" column, inline "suspend zone" toggle. |
| M4 | Area Confirmation Flow | Add: Boundary preview overlay on SA's map before confirm. Show conflict check result inline. Allow SA to edit the polygon before approving. |
| M5 | Escalation Oversight | Add: Escalation aging (how many hours since created), SLA clock for escalations themselves, bulk resolve for resolved reports. |
| M6 | System Settings | Add: Per-category global SLA defaults (mirror the per-area config but as city-wide baseline). Night-shift SLA multiplier config. Emergency bypass score threshold. |

---

### 🏛️ ADMIN (Municipal Official) — New & Modified Features

#### 🆕 New Features

| # | Feature | Description |
|---|---|---|
| 1 | **Field Dispatch System** | Admin can "dispatch" a specific report to a field worker (assign to a sub-user or mark with a worker ID). New status `dispatched` already exists in schema. Add a dispatch log with worker name, ETA, and GPS tracking link. |
| 2 | **Bulk Status Update** | Multi-select reports in the Requests tab → bulk change status (e.g., "mark all in_progress" for storm-related reports). |
| 3 | **Report Timeline View** | Instead of a flat list, show a Kanban-style board: columns for Pending / In Progress / Resolved. Drag-and-drop to change status. |
| 4 | **SLA Warning Inbox** | Dedicated section showing reports whose SLA will breach in the next 2/4/8 hours, sorted by urgency. Currently, only the server-side cron handles this — surface it to the admin. |
| 5 | **Citizen Communication Thread** | Official comment with `is_official = TRUE` creates a push notification to the report author. Add a "reply to citizen" button that pre-populates an official comment. |
| 6 | **Resolution Quality Check** | After resolving, the original citizen gets a "Was this resolved satisfactorily?" prompt (thumbs up/down + optional note). Results feed into admin's satisfaction score. |
| 7 | **Area Report Export** | Download all reports in the zone as CSV/Excel — for meetings, govt submissions, monthly reports. |
| 8 | **Smart Escalation Suggestions** | When an admin views a report, the system checks if any neighboring area has fewer pending reports of that category and suggests escalating there. |
| 9 | **Department Routing** | Reports have a `department` field but routing isn't implemented. Add a UI where admin assigns specific reports to dept sub-queues (Water Dept, Roads Dept, Sanitation Dept) each with their own SLA clock. |
| 10 | **Offline-First PWA Mode** | Convert the admin dashboard to a Progressive Web App. Cache the jurisdiction data and allow report status updates offline; sync when back online (critical for field workers). |
| 11 | **Voice Note on Resolution** | Allow official to record a short voice memo as part of the resolution evidence (alongside the after-photo). Store in Supabase Storage. |
| 12 | **Automated Weekly Digest Email** | Every Monday, send the admin an email (via Supabase Edge Function or Nodemailer) with: new reports, resolved count, SLA compliance, top issues by category. |

#### 🔧 Modified/Upgraded Existing Features

| # | Current Feature | Upgrade |
|---|---|---|
| M1 | Overview Stats Cards | Add: SLA compliance % for the zone, avg time-to-first-response, comparison vs. previous month (delta). |
| M2 | Zone Map | Add: Heatmap layer toggle, cluster markers for dense areas, filter panel on the side, satellite/street tile toggle. |
| M3 | Geofence Editor | Add: Import boundary from GeoJSON file, snap-to-grid option, undo/redo stack for polygon editing. Show population covered estimate. |
| M4 | Distance-Verified Resolution | Upgrade: If official denies GPS, allow SA to override the geo-lock with a reason code. Add a "self-verify" bypass with a security photo of the resolved site. |
| M5 | Escalation Management | Add: SLA timer showing how long the escalation has been pending, ability to add a collaborative note before accepting. |
| M6 | Settings Page | Add: Custom notification email(s) per category (e.g., water issues go to waterboard@city.gov). Dark/light toggle. Custom area color picker. |
| M7 | Admin Notes | Make notes visible to the report's author with a "public note" toggle (enables citizen communication without full comment exposure). |

---

### 👥 CITIZEN — New & Modified Features

#### 🆕 New Features

| # | Feature | Description |
|---|---|---|
| 1 | **Report Status Tracker** | Citizen-facing timeline for their own reports: "Submitted → Verified → In Progress → Resolved" with timestamps and official comments. Like a package tracking page. |
| 2 | **Nearby Reports Radar** | On the map, show reports within a configurable radius of the user's current location. "5 issues near you" widget on the feed homepage. |
| 3 | **"Me Too" Button** | Distinct from voting — a "I'm affected too" button that doesn't affect net_votes but increments a `me_too_count`. Helps officials gauge community impact without gaming the pin threshold. |
| 4 | **Push Notifications (PWA)** | Web Push API integration. Citizen subscribes to notifications for their ward. When a new report is pinned or their report status changes, they get a push even if the app is closed. |
| 5 | **Before/After Photo Gallery** | Public display of the `after_image_url` alongside the original `image_url` when a report is resolved. Citizens can see tangible proof of resolution. |
| 6 | **Civic Badge System** | Expand current `badge` field into a full badge collection: "First Reporter," "Verified 10 Issues," "Upvote King," "Night Watch" (night report), "Phantom" (anonymous reports), displayed on profile. |
| 7 | **Report Following** | Allow citizens to "follow" any report (not their own) — receive status-change notifications for it. Adds social accountability. |
| 8 | **Ward Discovery Page** | Show the citizen which ward/zone they're in based on GPS, who the admin is, current pending issues count, and zone performance stats. |
| 9 | **Resolution Satisfaction Rating** | After a report is resolved, a 1–5 star prompt appears on the card. Results aggregate into admin's performance dashboard. |
| 10 | **Report Collections / Tags** | Citizens can add custom tags to reports (e.g., "#schoolzone", "#flooding2025"). Tags are searchable and aggregatable. |
| 11 | **Share Report** | Native share button (Web Share API) on each PostCard — share the report URL on WhatsApp, Twitter, etc. Generates a shareable card image (like OG cards). |
| 12 | **Guest Mode Reporting** | Allow anonymous, unregistered users to submit reports (with CAPTCHA). Auto-convert to anonymous report. Email optional for updates. |

#### 🔧 Modified/Upgraded Existing Features

| # | Current Feature | Upgrade |
|---|---|---|
| M1 | Report Creation Form | Add: Category auto-suggest based on description keywords (client-side NLP or simple keyword matching). Pre-fill address from reverse geocoding. Drag photo from gallery. |
| M2 | Feed Page | Add: "For You" personalized feed based on user's most-reported category. "Near Me" feed tab using browser GPS. Inline before/after swipe comparison on resolved cards. |
| M3 | Leaderboard | Add: Ward-level leaderboard (top reporters within your zone). Weekly/monthly time-filter. Category-specific rankings. |
| M4 | Map Page | Add: Cluster markers, satellite imagery toggle, filter by status/category, user location centering button. |
| M5 | Vote System | Add: Vote cooldown for downvotes (prevent brigading). Visual vote animation (confetti/pulse on upvote). |
| M6 | Comments | Add: Comment reactions (👍❤️😠), markdown support for official comments, nested replies (1 level deep). |
| M7 | Profile Page | Add: Karma score display, badge showcase, activity history graph, "top category" badge, editable bio. |
| M8 | Smart Deduplication | Upgrade: Instead of silent merge, show citizen a "Your report matches an existing one. View it or submit separately?" dialog with a map pin preview. |
| M9 | Profanity Filter | Upgrade from regex to a proper word-list library (`bad-words` npm) with configurable severity levels. Auto-censor vs. block. |
| M10 | Anonymous Reporting | Add: Anonymous session cookie so anonymous user can still track the report's status without an account. |

---

## 🏆 Technical Architecture Upgrades

| # | Technique | Description |
|---|---|---|
| T1 | **Redis Caching Layer** | Cache: stats endpoints (SA overview, leaderboard), geofence geometries, and session tokens. Dramatically reduces DB load on high-traffic read paths. |
| T2 | **WebSocket Rooms** | Instead of `io.emit()` broadcasting to ALL clients, use Socket.io rooms: `ward_<code>`, `dept_<dept>`, `area_<id>`. Targeted, efficient real-time updates. The codebase already emits to rooms for urgent tasks — extend this fully. |
| T3 | **PostGIS Spatial Indexes** | Already has GIST indexes. Add: `ST_DWithin` index for the deduplication query (currently uses `ABS(lat-lat) < 0.0005` which is not spatially indexed). |
| T4 | **Refresh Token Rotation** | Current JWT is 30 days with no rotation. Implement refresh tokens (short-lived access + long-lived refresh) for better security. |
| T5 | **API Versioning** | Prefix routes as `/api/v1/*` now to prevent breaking changes as the platform evolves. |
| T6 | **Rate Limiting per User** | Current rate limits are IP-based. Add user-ID-based rate limiting (stored in Redis) for authenticated endpoints to prevent abuse from shared IPs (offices/schools). |
| T7 | **Supabase Edge Functions** | Move the SLA cron and email digest logic to Supabase Edge Functions (Deno) — removes the Node server burden and works even if the Node server is down. |
| T8 | **PWA / Service Worker** | Add a `manifest.json` and service worker. Enable offline report drafting, background sync, and push notifications. |
| T9 | **Structured Logging** | Replace `console.log/error` with a structured logger (Winston or Pino) with log levels, timestamps, and log shipping (e.g., to Supabase or Logtail). |
| T10 | **Report Image CDN** | Serve Supabase storage images through a CDN transform URL (`?width=400&quality=80`) instead of full-res on feed cards. Massive bandwidth savings. |
| T11 | **DB Connection Pooling** | Use `pg-pool` or PgBouncer in front of the Supabase direct connection to handle concurrency spikes without hitting connection limits. |
| T12 | **E2E Testing** | Add Playwright or Cypress tests for critical flows: citizen report creation, admin resolve + distance check, SA area confirmation. |

---

## 📊 Priority Matrix

| Priority | Feature | Tier | Impact |
|---|---|---|---|
| 🔴 **Critical** | SLA Warning Inbox | Admin | Prevents SLA breaches from going unnoticed |
| 🔴 **Critical** | Report Status Tracker | Citizen | Closes the accountability loop |
| 🔴 **Critical** | WebSocket Rooms | Tech | Fixes broadcast inefficiency at scale |
| 🟠 **High** | Before/After Photo Gallery | Citizen | Visual proof of civic action |
| 🟠 **High** | City Health Score | SuperAdmin | Objective performance measurement |
| 🟠 **High** | Bulk Status Update | Admin | Efficiency for disaster events |
| 🟠 **High** | Redis Caching | Tech | Performance at scale |
| 🟡 **Medium** | Civic Badge System | Citizen | Retention & engagement |
| 🟡 **Medium** | Admin Performance Scorecard | SuperAdmin | Accountability |
| 🟡 **Medium** | Field Dispatch System | Admin | Operational workflow |
| 🟢 **Low** | Trend Forecasting | SuperAdmin | Predictive governance |
| 🟢 **Low** | Voice Note on Resolution | Admin | Evidence quality |
| 🟢 **Low** | Report Collections/Tags | Citizen | Community organization |
