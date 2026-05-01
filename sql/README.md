# CityPulse — SQL Reference

All database scripts for CityPulse v3.0 (Supabase/PostgreSQL + PostGIS).

## Execution Order (Fresh Setup)

Run files in this order in **Supabase SQL Editor**:

| File | Purpose |
|------|---------|
| `00_extensions.sql` | Enable PostGIS + uuid-ossp |
| `01_tables.sql` | Create all 15 core tables |
| `02_permissions.sql` | RBAC permissions table + seed data |
| `03_indexes.sql` | Spatial (GIST) + B-tree performance indexes |
| `04_functions.sql` | Core functions: exec_sql, check_area_overlap, SLA calc |
| `05_triggers.sql` | All 6 automated triggers |
| `06_rls_policies.sql` | Row Level Security — service role full access |
| `07_data_sync.sql` | ⚠️ One-time data integrity sync (existing DBs only) |
| `08_migrations.sql` | Safe ALTER TABLE migrations (existing DBs only) |
| `09_storage.sql` | Supabase Storage bucket for images |
| `10_views.sql` | Read-only query views (optional, simplify Node.js) |

> Or just paste `00_RUN_ALL.sql` for a fresh setup (tables only, skip 07/08).

---

## Schema Overview (15 Tables)

| Table | Purpose |
|-------|---------|
| `users` | Citizens, admins, super_admin — role-based |
| `municipal_areas` | PostGIS MultiPolygon jurisdictions |
| `boundary_proposals` | Admin → SA geofence change requests |
| `reports` | Civic issue reports with spatial geom + SLA |
| `votes` | Up/down votes (unique per user per report) |
| `comments` | Report comments (is_official flag for admin) |
| `escalations` | Cross-ward transfers with status lifecycle |
| `activity_log` | JSONB audit trail of all admin actions |
| `admin_settings` | Per-admin config: SLA, threshold, geofence |
| `admin_notes` | Internal annotations on reports |
| `permissions` | 7 fine-grained RBAC permissions |
| `role_permissions` | role → permission mapping |
| `system_settings` | Global defaults (SA-managed) |
| `report_status_history` | Timeline of every status change |
| `audit_logs` | Immutable diff log (JSONB old/new) |

---

## Triggers Summary

| Trigger | Table | Event | Effect |
|---------|-------|-------|--------|
| `tr_sync_report_geom` | reports | INSERT/UPDATE lat/lng | Auto-generates PostGIS Point |
| `tr_update_report_count` | reports | INSERT/DELETE | users.report_count ±1 |
| `tr_log_status_change` | reports | UPDATE status | Logs to report_status_history |
| `tr_boundary_shift` | municipal_areas | UPDATE geofence | Re-assigns unresolved reports |
| `tr_check_legal_hold` | reports | DELETE | Blocks deletion of held reports |
| `tr_*_updated_at` | reports, areas, escalations | UPDATE | Refreshes updated_at |

---

## Key Functions

| Function | Purpose |
|----------|---------|
| `exec_sql(text)` | HTTP bridge —: runs arbitrary SQL from Node.js via RPC |
| `check_area_overlap(geom, exclude_id)` | Returns conflicting active zones |
| `get_area_for_point(lat, lng)` | Ward detection from coordinates |
| `calculate_sla_due(severity, is_night)` | Returns SLA deadline TIMESTAMPTZ |
| `citizen_score(verified, upvotes, reports)` | Leaderboard score formula |

---

## Removed Features

- **`report_me_toos` table** — The "Me Too" button was removed in favor of the existing upvote system. The `me_too_count` column and associated trigger from earlier iterations are not included. The `unique_upvoters` count via upvotes already serves the community impact purpose.
