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

## Phase 14: Guided Demo Tour & Scenario Simulator

- [x] Add scenario API contracts, ADMIN authorization, and transactional deterministic data loading.
- [x] Seed 3 vehicles, 12 mixed-status orders, POD/signatures/notifications, 2 telemetry vehicles, and 14 analytics snapshots.
- [x] Add strict frontend scenario contracts and data synchronization after loading.
- [x] Add the role-aware floating demo button, five-step guided workflow, and architecture tab.
- [x] Add VI/EN translations and verify backend/frontend tests, typecheck, build, browser behavior, and final diff quality.

## Phase 15: COD Reconciliation, Dynamic VietQR & Driver Shift Cash Settlement

- [x] Add migration 013, the `init_db.py` mirror, COD order columns, and the driver shift settlement table.
- [x] Add the NAPAS VietQR payload builder and the COD API: summary, collection, shift settlement, cashier review, ledger, and CSV export.
- [x] Bind settled orders by foreign key and reconcile every order in one transaction on cashier approval.
- [x] Add strict frontend COD contracts, VND formatting, and Excel-compatible ledger export with formula neutralisation.
- [x] Add the `/admin/cod` reconciliation centre, KPI hero, settlement review, and order COD ledger.
- [x] Add driver COD badges, the dynamic VietQR modal, and the end-of-shift cash settlement drawer.
- [x] Add the COD and VietQR block to the order drawer and the printable A4/A5 delivery bill.
- [x] Remove the demo tour architecture tab, `STACK_ITEMS`, and orphaned `demo.architecture.*` keys.
- [x] Add VI/EN translations and verify pytest, Vitest, typecheck, and production build.

## Phase 17: Console Design Sync (Dark Cinema chrome)

- [x] Share the Dark Cinema tokens between the landing portal and the console chrome, with a separate accent ink for light surfaces.
- [x] Convert the sidebar and both mobile bars to the cinema ground with the amber active state.
- [x] Give the theme and language switchers a `tone` prop so the light pages keep their styling.
- [x] Add `StatTile` / `StatStrip` / `SectionLabel` and adopt them in the dashboard and the COD reconciliation centre.
- [x] Carry the landing uppercase micro-label signature into `PageHeader`.
- [x] Point every landing call-to-action at `/login`.
- [x] Fix the two measured contrast failures (mobile bar 3.84:1, logo mark 3.67:1) and verify typecheck, 167 tests, and the production build.

### Still open

- [ ] Tune the data-heavy bodies (orders, dispatch, fleet, drivers, analytics, driver workspace) to the new rhythm; they inherit the chrome and header today but their cards still use the older radius and label scale.
- [ ] Decide whether the remaining `teal-*` usages that are decorative rather than status-bearing should move to the accent.

## Phase 18: Console Dark UI (reference-matched, accessible)

- [x] Retune the dark slate steps to charcoal so all 54 screens adopt the reference ground at once; default the console to dark while keeping the light toggle.
- [x] Swap the hand-rolled nav icon set and the emoji affordances for Heroicons.
- [x] Add the shared control module (search, select, pill button, metric chip, panel) built on real form elements.
- [x] Raise every contrast defect found: primary actions, muted text, driver markers, map attribution, diagnostic markers.
- [x] Fix the heading skip on the COD page and wrap filter groups in `<search>`.
- [x] Audit twelve routes at desktop and 375 px: zero accessibility, semantic, or overflow findings.
- [x] Verify typecheck, 167 tests, production build, and 136 backend tests.

### Still open

- [ ] Adopt the shared controls on the pages that grow a toolbar later; orders, fleet, and drivers have no search or filter row today.
- [ ] The reference uses circular brand avatars in its list rows. The order and fleet lists could carry depot or vehicle marks the same way once there is artwork for them.

## Phase 19: Landing parity — one accent across the whole product

- [x] Confirm amber-400 is the portal's only accent, then adopt it as the product accent.
- [x] Move warning states to orange first, so brand and caution stay distinguishable.
- [x] Swap brand teal to amber across 582 occurrences in 51 files, landing untouched.
- [x] Repair the five buttons whose shade stopped carrying white text after the swap.
- [x] Align the chrome accent token and the brand ramp to the portal's exact amber.
- [x] Re-audit twelve routes in three roles at desktop and 375 px: zero findings.
- [x] Verify typecheck, 167 frontend tests, production build, 136 backend tests.

### Still open

- [ ] `--color-brand-*` is now correct but still almost unused; either adopt it in place of raw `amber-*` classes or drop it.
- [ ] The portal separates its service cards with hairline rules rather than bordered cards. Data screens need the card, but the marketing-adjacent surfaces (dashboard cost panel, driver shift summary) could take the lighter treatment.

## Phase 20: Portal form language across every screen

- [x] Add `components/ui/Section.tsx` encoding the portal's layout vocabulary.
- [x] Rebuild the Orders screen as the reference and get it approved.
- [x] Soften the palette to the reference's subdued tone and float the service row over the hero photograph.
- [x] Square 321 radii and remove 90 shadows across 60 files, keeping `rounded-full`.
- [x] Restyle 37 section headings to wide uppercase, excluding dialogs, names and printed output.
- [x] Flatten the stat tiles onto the hairline grid.
- [x] Move sign-in onto the portal ground, fixing its 3.42:1 body copy.
- [x] Replace the teal that lived as hex in chart, map and route-palette code.
- [x] Fix the tracking timeline's 2.08:1 check mark.
- [x] Audit thirteen routes in three roles at desktop and mobile: zero findings.
- [x] Verify typecheck, 167 frontend tests, production build, 136 backend tests.

### Still open

- [ ] `DriverStatusDialog` picked up uppercase section headings. It is a dialog, so it was meant to be excluded; the three headings there title blocks rather than the dialog itself, but it deserves a look with a driver on a phone.
- [ ] Leaflet renders its overlay pane without `aria-hidden`. Harmless today, but worth a wrapper if the maps ever carry announced content.
