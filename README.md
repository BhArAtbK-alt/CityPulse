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

## 📜 License
This project is licensed under the MIT License

---
