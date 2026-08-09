# LogiRoute VN TODO

- [x] Create clean monorepo directory.
- [x] Add web shell.
- [x] Add FastAPI health endpoint.
- [x] Add PostGIS Compose file.
- [x] Add bootstrap script.
- [x] Add database init migration and SQLAlchemy domain models for depots, vehicles, and orders.
- [x] Add overview, orders, vehicles, and seed APIs.
- [x] Connect the Dashboard KPI cards to the live overview API.

## Phase 3: Route Optimization Integration

- [x] Package `core_engine` for use by the FastAPI service.
- [x] Add `POST /api/v1/routes/optimize` with pending-order assignment.
- [x] Add the interactive Map/Optimization page with loading, route cards, summary metrics, and route preview.
- [x] Render optimized routes on real roads with OSRM and refresh Orders state after optimization.
- [x] Add User authentication, JWT access tokens, and role-based protection for operational APIs.
- [x] Add route cost analytics, persistent optimization snapshots, Dashboard sustainability metrics, and CSV manifest export.
- [x] Add the protected Analytics history API and `/analytics` dashboard with period filters, charts, and CSV export.

- [ ] Use a road-network cost matrix and add advanced optimization constraints.

## Phase 7: Manual Route Reordering

- [x] Add route batch identity and reorder API contracts.
- [x] Persist manual stop ordering and cross-vehicle assignments transactionally.
- [x] Recalculate distance, duration, cost, and CO2 with OSRM fallback.
- [x] Add accessible drag-and-drop route editing with capacity validation.
- [x] Add save/cancel controls and synchronize map, orders, fleet, driver, overview, and analytics data.
- [x] Verify backend tests, frontend tests, typecheck, production build, and browser behavior.

## Phase 8: Live Fleet Telemetry & Route Deviation

- [x] Add vehicle GPS/deviation columns and idempotent database migration.
- [x] Add tested segment-distance and route-deviation service logic.
- [x] Add driver telemetry ping and dispatcher telemetry list endpoints.
- [x] Seed telemetry coordinates for active demo vehicles.
- [x] Add frontend telemetry contracts, polling toggle, fleet counters, markers, and popups.
- [x] Verify pytest, Vitest, typecheck, and production build.
- [ ] Verify authenticated polling, map movement, and deviation alert behavior in a running browser.

## Phase 9: Customer Notification Simulator

- [x] Add the customer notification model, migration, schemas, and template service.
- [x] Trigger notification logs for assignment, delivery progress, success, and failure.
- [x] Add protected notification history and resend endpoints.
- [x] Seed realistic Zalo/SMS notification history without duplicates.
- [x] Add notification contracts, drawer history, phone preview, resend, and copy UI.
- [x] Add VI/EN labels and verify pytest, Vitest, typecheck, and production build.

## Phase 10: Digital Signature & Printable Delivery Bill

- [x] Add recipient signature columns and idempotent migration `011`.
- [x] Add secure driver signature upload storage, API contract, audit log, and tests.
- [x] Add signature fields to Order/Driver frontend contracts.
- [x] Add the mobile Hi-DPI SignaturePad and delivered-order upload flow.
- [x] Add the printable delivery bill preview, tracking QR, POD/signature evidence, and print CSS.
- [x] Add VI/EN labels and verify pytest, Vitest, typecheck, and production build.

## Phase 11: National Multi-Depot Hubs & Operations Benchmark

- [x] Add multi-depot database fields, migration `012`, and safe legacy backfill.
- [x] Add protected depot CRUD and depot-scoped operational API queries.
- [x] Seed HUB-SGN, HUB-HAN, HUB-DAD, and HUB-VCA idempotently.
- [x] Add frontend depot contracts, context persistence, and accessible switcher.
- [x] Add the admin depot page with operational aggregate cards and create form.
- [x] Fly the Dispatch map to the selected hub and refetch scoped route/telemetry data.
- [x] Add deterministic CVRP benchmark reporting for 10/25/50/100 orders.
- [x] Verify backend/frontend tests, typecheck, production build, and benchmark execution.

## Phase 12: Driver Performance Leaderboard & Eco Scorecard

- [x] Add performance API schemas, deterministic scoring, depot filtering, and RBAC tests.
- [x] Seed three drivers with varied 30-day delivery histories.
- [x] Add validated frontend contracts and Excel-compatible CSV export.
- [x] Add directory/leaderboard tabs, Top 3 podium, responsive ranking table, and 7/14/30-day filters.
- [x] Add VI/EN translations and verify pytest, Vitest, typecheck, and production build.

## Phase 13: System Health & Diagnostic Center

- [x] Add six-service health contracts and the ADMIN-only `/system/health` endpoint.
- [x] Add five safe, non-destructive system diagnostics and the `/system/diagnostics` endpoint.
- [x] Add strict frontend contracts, system audit report export, and tests.
- [x] Add the ADMIN-only infrastructure dashboard, subsystem cards, and self-test console.
- [x] Add navigation, VI/EN translations, loading/error/degraded states, and accessibility behavior.
- [x] Verify pytest, Vitest, typecheck, production build, and final diff quality.
