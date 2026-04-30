# CityPulse 🏙️ (v3.0 - Cloud Edition)
### *The Next-Generation Civic Intelligence System*

CityPulse is a comprehensive, full-stack platform designed to revolutionize the way citizens and municipal authorities interact. By integrating **Real-Time Geospatial Intelligence**, **Multi-Tenancy Geofencing**, and **Social Gamification**, CityPulse transforms the static process of "complaint filing" into a dynamic, transparent, and community-driven movement for urban excellence.

---

## 🏗️ Major Upgrade: Version 3.0 (Cloud Native)
The latest version of CityPulse has transitioned to a **high-performance cloud infrastructure using Supabase and PostgreSQL**, enabling enterprise-grade security, PostGIS spatial capabilities, and real-time data scaling.

### **✨ New in v3.0**
- **Supabase Cloud Backend:** Reliable, scalable PostgreSQL database.
- **PostGIS Geospatial Engine:** Server-side spatial filtering for accurate ward-level jurisdiction.
- **Geofencing 2.0:** Dynamic polygon boundary definition for administrators with overlap prevention.
- **Advanced Authentication:** Integrated Supabase Auth with **Forgot Password** and **Reset Password** functionality.
- **Multi-Level Administration:** Dedicated dashboards for Citizens, Municipal Officials (Admins), and City-Wide Super Admins.

---

## 🛠️ Architecture & Tech Stack

### **Frontend**
- **React.js (Vite):** High-performance UI with a modular "Shell" architecture.
- **Socket.io-client:** Real-time bidirectional communication for live feeds and emergency alerts.
- **Leaflet & Turf.js:** Advanced geospatial rendering and ward-level polygon intersection logic.
- **Vanilla CSS (Dark Mode):** Custom-designed, responsive interface optimized for both mobile and desktop.

### **Backend**
- **Node.js & Express:** Robust RESTful API layer with integrated rate-limiting (Anti-Abuse).
- **Supabase Auth & Storage:** Enterprise-grade security and cloud image hosting.
- **PostgreSQL (PostGIS):** Relational database with advanced spatial indexing for high-speed geometry queries.
- **Node-Cron:** Automated background processing for SLA monitoring and report escalation.

---

## 🌟 Key Features

### **1. Geospatial Intelligence & Geofencing**
- **Zone-Strict Admin:** Admins manage a custom polygon "zone." They only see reports and statistics for their specific jurisdiction.
- **Ward-Level Mapping:** Automatically identifies the exact municipal ward for every report based on GPS coordinates using PostGIS.
- **Smart Deduplication:** Merges multiple reports of the same issue within a 50-meter radius into a single, high-impact entry to reduce data noise.

### **2. Accountability & SLA Engine**
- **The "SLA Hammer":** Automated tracking of resolution deadlines based on category severity. If a report is not addressed, it is automatically escalated.
- **Distance-Verified Resolution:** Officials must be physically present (within 200m) of the report location to mark it as resolved, verified via GPS.

### **3. SuperAdmin "God View"**
- **Global Map:** Real-time visualization of all reports and municipal boundaries across the city.
- **Jurisdiction Management:** SuperAdmins can create new zones, draw boundaries, and assign official administrators.
- **Orphaned Report Handling:** Re-assign reports that fall outside active jurisdictions to the correct municipal area.

---

## 🚦 Getting Started

### **Prerequisites**
- Node.js (v18 or higher)
- A Supabase Project (URL & Service Key) with PostGIS extension enabled.

### **Installation**
1. Clone the repository.
2. Install all dependencies:
   ```bash
   npm run install:all
   ```
3. Set up your `.env` in the `server/` directory:
   ```env
   PORT=5000
   DATABASE_URL=your_supabase_postgres_string
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_supabase_service_key
   JWT_SECRET=your_jwt_secret
   ADMIN_SECRET_CODE=your_secret_code_for_admin_registration
   SUPER_ADMIN_CODE=your_secret_code_for_super_admin_registration
   CLIENT_URL=http://localhost:5173
   ```

### **Running the Project**
Launch both server and client concurrently:
```bash
npm run dev
```

---

## 🛡️ Admin Setup
To access the Admin Portal:
1. Register via the **"🛡️ Admin Registration"** link on the login page.
2. Enter the `ADMIN_SECRET_CODE` (for officials) or `SUPER_ADMIN_CODE` (for city-wide control).
3. Super Admins must verify and confirm newly registered Municipal Areas before they become active.

---

## 🤖 AI Integration (Optional)

CityPulse includes an **optional AI layer** powered by **Google Gemini Vision**. When enabled, it adds:

| Feature | What it Does |
|---|---|
| **Phase 1: Image Classification** | AI analyzes uploaded photos to auto-detect issue category (pothole, garbage, etc.) and generates a rigid title. |
| **Phase 2: Description Matching** | AI verifies that the user's written description matches the uploaded photo, preventing false reports. |
| **Phase 3: Resolution Audit** | When admins resolve an issue, AI compares before/after photos to verify the fix is genuine. |

### ✅ How to Enable AI

1. **Get a Gemini API Key** :
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Create a new API key

2. **Add to your `.env`** (in `server/`):
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Run the AI database migration** :
   ```sql
   -- Run in your Supabase SQL editor
   -- File: sql/11_ai_upgrade.sql
   ```

4. **Install dependencies** :
   ```bash
   cd server && npm install
   ```

5. **Restart the server** — you'll see:
   ```
   🤖 AI Features: ENABLED (Gemini Vision Active)
   ```

### ❌ How to Remove AI (Slim Codebase)

If you want a minimal codebase without any AI dependencies:

1. **Delete the AI feature folder:**
   ```bash
   rm -rf server/features/ai/
   ```

2. **Remove the dependency** from `server/package.json`:
   ```diff
   -  "@google/generative-ai": "^0.21.0"
   ```

3. **Revert route imports** in `server/routes/reports.js` and `server/routes/admin.js`:
   ```diff
   - const { AI_ENABLED, analyzeCivicIssue, validateDescriptionMatch } = require("../features/ai");
   ```
   Remove the AI endpoint blocks at the bottom of `reports.js` (marked with `🤖 AI ENDPOINTS`).

4. **Run `npm install`** to clean up `node_modules`.

> **Note:** The base CityPulse project works perfectly without AI. All AI features are guarded behind `AI_ENABLED` checks — if `GEMINI_API_KEY` is not set, AI endpoints return `503` and the UI automatically falls back to manual mode.

### 📁 AI Architecture

```
server/
├── features/
│   └── ai/
│       ├── index.js       ← Feature gate (exports AI_ENABLED flag)
│       └── ai-vision.js   ← Gemini Vision (3 phases)
├── routes/
│   ├── reports.js         ← AI endpoints wrapped in AI_ENABLED guard
│   └── admin.js           ← AI resolve audit (conditional)
sql/
└── 11_ai_upgrade.sql      ← AI-specific DB columns & tables
```

---

## 📜 License
This project is licensed under the MIT License

---
