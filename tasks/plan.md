# Implementation Plan: LogiRoute VN Boilerplate

## Overview

Create a clean monorepo foundation for LogiRoute VN with a Next.js App Router frontend, a FastAPI backend, a Python route-optimization engine workspace, and a local PostgreSQL/PostGIS service.

## Architecture decisions

- Treat `D:\Individual_Project` as the dedicated LogiRoute VN project root.
- Use Next.js App Router file-system routes for the web application.
- Keep FastAPI as a small independently runnable service with explicit CORS for the local web origin.
- Pin the PostGIS image to PostgreSQL 17 / PostGIS 3.5 for a stable local data volume path.
- Defer authentication, production routing algorithms, and real database models until the skeleton is verified.

## Task list

### Phase 1: Foundation

- [x] Create the new project root and remove the legacy project source.
- [x] Add repository hygiene files and local environment examples.

### Phase 2: Web

- [x] Add a runnable Next.js App Router shell.
- [x] Add placeholder routes for Dashboard, Orders, Fleet, and Map.

### Phase 3: API and engine

- [x] Add a runnable FastAPI health endpoint.
- [x] Add the `core_engine` workspace README.

### Phase 4: Local infrastructure

- [x] Add PostGIS Docker Compose configuration.
- [x] Add a repeatable PowerShell bootstrap script.

### Checkpoint

- [x] Frontend production build succeeds.
- [x] FastAPI imports and serves `/api/health`.
- [x] Docker Compose configuration parses successfully.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Project source is deleted accidentally | High | Keep source under Git and use explicit, reviewed paths for future cleanup. |
| Frontend and API ports differ locally | Medium | Configure explicit CORS for `http://localhost:3000`. |
| Database volume format changes with PostgreSQL 18 | Medium | Pin PostgreSQL 17 / PostGIS 3.5 and document the volume path. |

## Phase 7: Manual Route Reordering

### Architecture decisions

- Extend optimization responses with `route_batch_id` so a persisted route plan can be edited safely.
- Keep drag-and-drop state local until the dispatcher explicitly saves it.
- Validate route ownership, complete batch coverage, contiguous sequences, and vehicle capacity again on the server.
- Recalculate route metrics with OSRM when available and fall back to Haversine distance multiplied by 1.25.
- Persist order changes, audit logs, vehicle states, and the analytics snapshot in one transaction.

### Task list

- [x] Add typed reorder request contracts and backend validation tests.
- [x] Implement transactional `POST /api/v1/routes/reorder` and route metric fallback.
- [x] Add testable frontend helpers for moving stops, capacity checks, and preview metrics.
- [x] Integrate accessible drag-and-drop lists into the Dispatch Center.
- [x] Add save/cancel feedback, data invalidation, and VI/EN translations.
- [x] Run backend/frontend tests, typecheck, build, and browser verification.

### Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Concurrent driver updates overwrite a manual plan | High | Lock and revalidate all batch orders; reject routes already in progress. |
| External OSRM latency blocks saving | Medium | Use a short timeout and deterministic Haversine fallback. |
| Cross-vehicle drag exceeds capacity | High | Check on both client and server before persistence. |
| Frontend and backend route totals diverge | Medium | Treat client values as preview only and replace them with the server response after save. |

## Phase 8: Live Fleet Telemetry & Route Deviation

### Architecture decisions

- Persist the latest GPS ping on `vehicles`; historical GPS storage is outside this phase.
- Reuse one typed telemetry item contract for driver ping responses and dispatcher fleet reads.
- Calculate deviation against the bounded previous-to-next-stop segment, with depot fallback for the first stop.
- Poll every five seconds only while the dispatcher toggle is enabled; abort stale requests during teardown.
- Keep marker updates independent from route geometry fetching so telemetry refreshes do not refetch OSRM paths.

### Task list

- [x] Add idempotent telemetry columns, schemas, geometry helpers, and focused tests.
- [x] Add protected driver ping and admin fleet telemetry endpoints.
- [x] Seed realistic telemetry for active demo vehicles.
- [x] Add validated frontend contracts, polling controls, vehicle markers, and VI/EN labels.
- [x] Run backend/frontend tests, typecheck, and production build.
- [ ] Complete authenticated browser verification with the developer servers running.

### Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| GPS point is compared with an infinite line instead of the active segment | High | Clamp vector projection to the segment endpoints and test endpoint cases. |
| Poll responses arrive out of order | Medium | Abort the previous request on teardown and keep one polling loop per mounted Dispatch Center. |
| Missing GPS data crashes Leaflet | Medium | Validate API data and filter vehicles without finite coordinates before rendering. |
| Existing local database lacks new columns | High | Add revision `009` and mirror it in the idempotent bootstrap script. |

## Phase 9: Customer Notification Simulator

### Architecture decisions

- Store simulated Zalo ZNS and SMS messages as immutable order sub-resources with cascade deletion.
- Generate templates in one service and call it inside the existing order transaction; no external network call can block dispatch or driver status updates.
- Skip notification creation when an order has no customer phone number.
- Use one configured public tracking base URL with the local default `http://localhost:3001`.
- Protect notification history and resend endpoints with ADMIN/DISPATCHER RBAC because they expose customer phone numbers.

### Task list

- [x] Define notification enums, model, migration, schemas, and contract tests.
- [x] Implement deterministic templates, automatic triggers, history, resend, and seed data.
- [x] Add frontend response guards, notification history UI, phone preview, resend, and copy interactions.
- [x] Add VI/EN translations and update task documentation.
- [x] Run focused and full backend/frontend tests, typecheck, and production build.

### Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Repeated status requests create duplicate messages | Medium | Emit automatic notifications only for real status transitions. |
| Notification persistence breaks the delivery transaction | High | Keep the simulator DB-only, validate inputs, and commit it atomically with the originating action. |
| Customer phone data leaks to unauthorized users | High | Require ADMIN/DISPATCHER roles and never expose notification history publicly. |
| Existing databases lack the notification table | High | Add revision `010` and mirror it in the idempotent bootstrap script. |

## Phase 10: Digital Signature & Printable Delivery Bill

### Architecture decisions

- Accept recipient signatures as authenticated `multipart/form-data` uploads containing one PNG file and a normalized recipient name.
- Validate content type, upload size, and PNG magic bytes before writing a random server-generated filename under `uploads/signatures`.
- Keep POD and signature uploads independent but submit them concurrently before the final `DELIVERED` status transaction.
- Add signature fields to the shared Order/Driver contracts so the driver workspace and dispatcher drawer use one source of truth.
- Render the delivery bill as an accessible client-side preview with a scannable tracking QR code and print-only CSS that isolates the bill from application chrome.

### Task list

- [x] Add signature database fields, migration, schemas, secure storage, endpoint, and backend tests.
- [x] Add typed frontend contracts and a Hi-DPI pointer-enabled signature canvas with tests for upload validation.
- [x] Integrate recipient name and parallel POD/signature uploads into the delivered-order workflow.
- [x] Add the printable A4/A5 delivery bill, QR tracking link, signature/POD evidence, and drawer controls.
- [x] Add VI/EN translations and run pytest, Vitest, typecheck, and production build.

### Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| A disguised or oversized upload reaches storage | High | Require PNG, cap bytes while streaming, verify magic bytes, and generate server-side filenames. |
| A driver uploads a signature for another route | High | Resolve the assigned vehicle and scope the order query to that vehicle before writing. |
| POD succeeds but signature fails | Medium | Upload both concurrently, keep the status unchanged on any failure, and allow a safe retry. |
| Print output includes application navigation | Medium | Isolate the bill with a dedicated print root and print-only visibility rules. |
| Existing databases lack signature columns | High | Add revision `011` and mirror it in the idempotent bootstrap script. |

## Phase 11: National Multi-Depot Hubs & Operations Benchmark

### Architecture decisions

- Treat the depot selected by `depot_id` as an explicit tenant-like operational scope; when omitted, resolve the unique default depot and fall back to the first depot for legacy databases.
- Backfill every existing order and vehicle to `HUB-SGN` before scoped queries are enabled, while keeping the foreign keys nullable for safe imports and staged migration.
- Keep depot aggregate fields read-only: vehicle count, active order count, and total fleet payload are calculated by the API instead of duplicating mutable counters in the depot table.
- Store the selected depot in a small React context and local storage; every scoped fetch carries the selected `depot_id` and publishes the existing invalidation events when the selection changes.
- Make the benchmark deterministic with fixed random seeds, bounded solver time, machine-readable JSON, and a Markdown report generated from the same result objects.

### Task list

- [x] Add depot schema fields, foreign keys, idempotent migration `012`, and database contract tests.
- [x] Add depot CRUD plus reusable default/scope resolution and endpoint tests.
- [x] Scope overview, orders, vehicles, optimization, available drivers, and telemetry by depot without breaking legacy calls.
- [x] Seed four national hubs and attach existing demo data to `HUB-SGN` idempotently.
- [x] Add typed depot contracts, `DepotContext`, accessible switcher, and admin depot management page.
- [x] Connect the Dispatch Center data, telemetry, optimization, and Leaflet fly-to behavior to the selected depot.
- [x] Add deterministic 10/25/50/100-order CVRP benchmark output in Markdown and JSON.
- [x] Add VI/EN translations and run pytest, Vitest, typecheck, build, and benchmark verification.

### Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Legacy rows disappear after scoped queries | High | Migration backfills `depot_id` to the default hub and tests omitted/explicit scope behavior. |
| Multiple depots become default | High | Enforce one default inside create/update transactions and use a deterministic fallback query. |
| Cross-depot route assignment mixes operational data | High | Filter depot, orders, and vehicles together and reject mismatched explicit IDs. |
| Depot changes cause stale frontend requests | Medium | Abort polling requests, key effects by depot ID, and clear the previous route result before refetch. |
| 100-order benchmark takes too long | Medium | Use deterministic data and a bounded per-case solver time while recording elapsed wall time. |

## Phase 12: Driver Performance Leaderboard & Eco Scorecard

### Architecture decisions

- Calculate ranking metrics on the backend and expose one validated response contract; the frontend only renders and exports the returned values.
- Count only terminal orders (`DELIVERED` and `FAILED`) whose `status_updated_at` falls inside the requested 7/14/30-day period.
- Reconstruct each driver's optimized distance from depot-to-stop sequences with Haversine distance and a road-shape factor, then reuse the existing cost calculator for CO2 savings.
- Use the vehicle's latest route-deviation signal for adherence because historical GPS pings are not persisted yet: `ON_ROUTE` maps to 98%, missing/stopped data to 95%, and an active off-route warning to 90%.
- Rank deterministically by overall score, then CO2 savings, normalized driver name, and driver ID.
- Treat an omitted `depot_id` as a nationwide report; the frontend sends the selected depot explicitly for branch-scoped views.

### Task list

- [x] Add tested performance schemas, calculation service, and protected admin endpoint.
- [x] Add idempotent multi-driver historical seed data with varied delivery outcomes.
- [x] Add strict frontend contracts, CSV export, responsive podium, ranking table, period filters, and directory/leaderboard tabs.
- [x] Add matching VI/EN translations and complete backend/frontend verification.

### Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Current telemetry is mistaken for full adherence history | High | Document the fallback and isolate it behind a helper that can later consume ping history without changing the API. |
| The same route distance is counted more than once | High | Group terminal stops by vehicle and route batch before reconstructing each route once. |
| Sparse demo data makes the podium meaningless | Medium | Seed three assigned drivers and deterministic terminal-order history across the 30-day period. |
| Equal scores reorder between requests | Medium | Apply stable CO2, name, and UUID tie-breakers after score sorting. |

## Phase 13: System Health & Diagnostic Center

### Architecture decisions

- Keep `GET /system/health` read-only and fast by using bounded database queries, local subsystem checks, and a short cached OSRM probe.
- Run deeper checks only through the explicit ADMIN-only diagnostics action; every test uses synthetic inputs or temporary files and never mutates operational records.
- Treat the database and optimization engine as critical services: either being down makes the overall system down, while optional dependency failures degrade the system.
- Return structured, stable service/test contracts so the frontend renders server-calculated status instead of inferring health client-side.
- Export the currently displayed health and diagnostic snapshot as a UTF-8 JSON audit report without exposing secrets, credentials, or customer data.

### Task list

- [x] Add tested system health and diagnostics schemas, service checks, and ADMIN-only API endpoints.
- [x] Add strict frontend contracts and report export helpers.
- [x] Add the ADMIN-only system page, overall status hero, six subsystem cards, and diagnostic console.
- [x] Add the sidebar entry, responsive states, accessibility behavior, and VI/EN translations.
- [x] Run backend/frontend tests, typecheck, production build, and review the final diff.

### Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| A slow external OSRM call violates the health endpoint latency target | High | Use a very short timeout and cache the bounded probe result; run the full fallback test only on demand. |
| Diagnostics accidentally alter production data | High | Use synthetic solver inputs, read-only SQL, and uniquely named temporary files deleted in `finally`. |
| Health details expose secrets or sensitive records | High | Return allowlisted aggregate metadata only; never include URLs with credentials, tokens, request payloads, or PII. |
| A non-critical simulator outage marks the whole API unavailable | Medium | Apply explicit critical-service aggregation and report optional failures as `DEGRADED`. |

## Phase 14: Guided Demo Tour & Scenario Simulator

### Architecture decisions

- Keep scenario loading behind ADMIN authorization because it replaces operational demo records; preserve users, credentials, depots, and the current login session.
- Run the operational reset and scenario insert in one database transaction, deleting dependent notification/activity rows before orders and vehicles so a failed load rolls back cleanly.
- Model supported scenario names as a validated enum and keep scenario data deterministic so repeated loads always produce the same 3 vehicles, 12 orders, 2 live telemetry vehicles, and 14 analytics snapshots.
- Expose a strict frontend response contract; after loading, refetch the canonical order list and publish existing cross-page invalidation events rather than maintaining a second demo-data cache.
- Show the tour to ADMIN and DISPATCHER users everywhere inside `AppShell`, while disabling the destructive loader for DISPATCHER and keeping all guided navigation available.

### Task list

- [x] Add RED tests for scenario authorization, deterministic counts, operational replacement, and user preservation.
- [x] Add the transactional scenario loader service, validated API schema, and ADMIN-only endpoint.
- [x] Add typed frontend scenario contracts and tests.
- [x] Add the accessible floating demo assistant, guided five-step modal, architecture tab, loading/success/error states, and role-aware controls.
- [x] Add matching VI/EN translations and run pytest, Vitest, typecheck, production build, browser smoke test, and final review.

### Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Scenario load destroys real operational data | High | Restrict to ADMIN, label the action clearly, preserve identities/depots, and keep all writes in one rollback-safe transaction. |
| Partial inserts leave inconsistent demo state | High | Delete and recreate dependent operational rows within one transaction and commit only after all assets and records are ready. |
| Guided links are inaccessible for the current role | Medium | Keep role-aware descriptions and disable/annotate actions that require a driver or ADMIN session. |
| Other pages retain stale data after loading | High | Refetch orders and publish invalidation for orders, fleet, driver, overview, and analytics immediately after success. |
| Repeated scenario loads create duplicates | Medium | Use a replace-style deterministic loader and verify exact counts across repeated calls. |


## Phase 15: COD Reconciliation, Dynamic VietQR, and Driver Shift Cash Settlement

### Architecture decisions

- Bind every settled order to its handover through `orders.shift_settlement_id` rather than re-deriving the shift from a timestamp window, so cashier approval updates an explicit, auditable set and a delivery completed between submission and approval cannot be swept into the wrong shift.
- Compute expected totals server-side and store only the driver's declared cash, persisting the difference as `variance_amount`; a handover that the system cannot disagree with cannot detect a shortfall, which is the point of reconciliation.
- Store VND as `NUMERIC(12, 0)` because the currency has no sub-unit and cash reconciliation must not inherit binary floating point rounding error; the API boundary exposes plain integers.
- Generate the VietQR EMVCo payload locally (NAPAS template plus CRC-16/CCITT) and render it with the existing `qrcode.react` dependency instead of embedding a remote `img.vietqr.io` image, so a printed delivery bill renders offline and no order amount or code is sent to a third-party host on every render. The hosted URL is kept only as a fallback link.
- Record COD collection inside the same transaction as the driver's DELIVERED status change, so a completed stop and its cash record can never disagree.
- Reject a mismatched handover back to the driver rather than leaving `REJECTED` as an unreachable state, releasing its orders so a corrected settlement can be filed.
- Remove the technical architecture tab from the demo tour: the console is an operations product, and a BE/FE stack diagram is not a logistics workflow.

### Task list

- [x] Add migration 013, mirror it in `init_db.py`, and extend the ORM with COD columns and the `DriverShiftSettlement` model.
- [x] Add the NAPAS-compliant VietQR payload builder with CRC validation and a bank BIN registry.
- [x] Add the COD router: summary, driver collection, shift preview/submit, cashier approve/reject, ledger, and UTF-8 BOM CSV export.
- [x] Seed realistic Vietnamese COD tickets (including prepaid orders) into the demo scenario.
- [x] Add strict frontend COD contracts, VND formatting, and Excel-safe ledger export.
- [x] Add the admin reconciliation centre, driver COD badges, VietQR modal, and end-of-shift settlement drawer.
- [x] Add the COD and VietQR block to the order drawer and the printable delivery bill.
- [x] Remove the demo tour architecture tab and its orphaned translation keys.
- [x] Add VI/EN translations and verify pytest, Vitest, typecheck, and production build.

### Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Two settlements claim the same orders | High | Lock the driver's vehicle row before reading the open shift and only collect orders whose `shift_settlement_id` is still null. |
| A cashier approves a shift while a stop is still being delivered | High | Scope the shift to completed stops only and bind them by foreign key at submission time. |
| Driver-declared cash silently hides a shortfall | High | Recompute expected cash server-side, persist the variance, and surface it in both the settlement list and the approval modal. |
| A printed bill loses its payment QR with no internet | Medium | Build the EMVCo payload server-side and render it locally with `qrcode.react` rather than loading a remote image. |
| A COD record changes after the money reaches the vault | High | Reject collection on an order that is already reconciled or attached to a submitted settlement. |
| Exported ledger text is executed by Excel | Medium | Prefix any cell starting with `=`, `+`, `-`, or `@` on both the API and client export paths. |


## Phase 17: Console Design Sync (Dark Cinema chrome)

### Architecture decisions

- Split the surface rather than the palette: the chrome (sidebar, mobile bars, stat tiles) commits to the Dark Cinema ground in both app themes, while data surfaces keep the light/dark toggle. This is what the reference fleet dashboards do, and it is the only split that lets the amber accent stay legible.
- Two accent tokens, not one. `--color-cinema-accent` (#f0b429) measures 10.68:1 on the cinema ground; the same hue as text on white measures 3.19:1 and fails AA. `--color-cinema-accent-ink` (#b45309) is the pitched down variant for light surfaces at 5.02:1. A single accent token would have quietly broken the contrast Phase 16 established.
- Teal stops being the brand colour and becomes a status colour (delivered, reconciled, success). That retires the teal/amber clash without touching the 537 `teal-*` occurrences across 54 files, because the ones that remain now carry meaning.
- `ThemeToggle` and `LanguageSwitcher` take a `tone` prop instead of being darkened outright: both also render on `/login`, `/register`, and the public tracking page, which stay light.
- `DepotSwitcher` and `UserProfileMenu` render only inside the sidebar, so they darken unconditionally and need no prop.
- Landing call-to-action points at `/login`, not `/dashboard`: the portal is public and the console is not, so the visitor signs in rather than bouncing off a route guard.

### Task list

- [x] Promote the Dark Cinema tokens from landing-only to a shared chrome layer, adding the accent-ink variant and `.console-chrome` / `.console-panel` classes.
- [x] Convert the sidebar, mobile top bar, and mobile bottom bar to the cinema ground with the amber active state.
- [x] Add a `tone` prop to the theme and language switchers; darken the depot switcher.
- [x] Add shared `StatTile` / `StatStrip` / `SectionLabel` primitives and adopt them in the dashboard and the COD centre.
- [x] Carry the landing typographic signature (uppercase micro-labels, tracking) into `PageHeader`.
- [x] Point every landing call-to-action at `/login` and update the Phase 16 test that pinned it to `/dashboard`.
- [x] Measure contrast through canvas colour resolution, fix what failed, and verify typecheck, tests, and build.

### Measured contrast

Measured in the browser through canvas colour resolution, because Tailwind v4 emits `lab()` and regex parsing of `getComputedStyle().color` reads LAB coordinates as RGB (Phase 16 handoff, 5.1).

| Sample | Before | After |
| --- | --- | --- |
| Sidebar active link on cinema ground | — | 10.68:1 |
| Page header eyebrow on slate-50 | 5.23:1 (teal) | 4.80:1 (accent ink) |
| Page header eyebrow, dark theme | — | 10.82:1 |
| Mobile bottom bar labels, worst case | **3.84:1** | 7.08:1 |
| Logo mark | **3.67:1** | 10.68:1 |
| Stat tile label and hint | — | 6.9:1 and above |

Two real failures were found and fixed. The mobile bar failure was introduced by this phase: the console bars float over light content, unlike the landing bars which float over the dark hero, so 0.78 alpha let the page beneath wash the labels out. The logo mark failure predated this phase (white on teal-600 at 12px/900).

### Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Amber accent used as text on a light surface | High | Two separate tokens, with the threshold recorded in a comment at each definition. |
| Chrome controls unreadable on the pages that stay light | Medium | `tone` prop defaults to the existing light styling; only the sidebar opts into chrome. |
| Screens outside this pass look half-converted | Medium | Every page inherits the chrome and `PageHeader`, so the shell reads as converted even before its body is tuned. |
| A later session reverts the accent split as a duplicate token | Medium | Both tokens carry their measured ratios in comments. |


## Phase 18: Console Dark UI (reference-matched, accessible)

### Architecture decisions

- Retune four steps of the slate ramp rather than repaint 54 files. Every screen already shipped a complete set of `dark:` variants, so moving `--color-slate-950/900/800/700` from Tailwind's navy to a neutral charcoal (#0b0d13 / #12151d / #1a1e29 / #262a35) converted the entire console to the reference ground in one edit. The light steps 50-600 are untouched, so light mode is unaffected.
- The console opens dark (`defaultTheme="dark"`, `enableSystem={false}`) but keeps the toggle. AGENTS.md section 3 asks for high contrast "under outdoor sunlight" for drivers; a dark ground meets that through contrast, and the toggle still gives a light option when it does not.
- Three surface depths, matching the reference: chrome #08090d, page #0b0d13, card #12151d. Depth reads without borders doing the work.
- Controls live in one module (`components/ui/Controls.tsx`) and render real `<label>`, `<input>`, `<select>`, `<button>` elements. A pill that only looks like a select would lose keyboard support, form semantics, and the structure answer engines read.
- Heroicons replace the hand-rolled navigation SVG set and the emoji used as UI affordances. Emoji that carry meaning rather than function (medal ranks, the eco leaf) stay, because they are content.
- Filter groups are wrapped in `<search>`, tab panels carry their own `<h2>` (screen-reader only where the tab button already names the panel on screen), and every decorative icon is `aria-hidden`.

### Contrast defects found and fixed

Measured in the browser through canvas colour resolution. Every one of these predated the redesign or was introduced by it; none were theoretical.

| Defect | Before | After | Origin |
| --- | --- | --- | --- |
| Primary action, white on teal-600 | 3.74:1 | 5.47:1 light / 10.43:1 dark | pre-existing, 43 buttons |
| Muted body text on the charcoal card | 3.83:1 | 6.9:1 | introduced by the darker ground |
| Driver stop marker, white on emerald-600 | 3.77:1 | 5.48:1 light / 10.10:1 dark | pre-existing |
| Map attribution over dark tiles | 3.70:1 | 13.08:1 | pre-existing |
| Idle diagnostic marker | 2.56:1 | 7.0:1 | pre-existing |
| COD tab panels skipped H1 to H3 | — | H1 to H2 to H3 | introduced in Phase 15 |

Two regressions were introduced by the bulk edits themselves and caught by re-measuring rather than by reading the diff:

- The muted-text pass matched `text-slate-500` inside `disabled:text-slate-500` and added an unprefixed `dark:text-slate-400`, which overrode a button label in every state.
- Because that pass ran first, the primary-action pass then saw a `dark:text-` already present on two lines and skipped pairing near-black text with the teal-400 fill, leaving white on teal-400 at 1.86:1.

The lesson for the next session: a bulk class edit needs a per-class-string guard, not a per-line one, and the result has to be measured in a browser afterwards.

### Task list

- [x] Retune the dark slate steps to charcoal and default the console to dark.
- [x] Replace the hand-rolled navigation icons and emoji affordances with Heroicons.
- [x] Add `components/ui/Controls.tsx` (search, select, pill button, metric chip, panel) and adopt it in the COD centre.
- [x] Give muted text a dark variant across 132 class strings in 45 files.
- [x] Raise every primary action, driver stop marker, map attribution, and diagnostic marker to AA.
- [x] Wrap filter groups in `<search>` and give the COD tab panels real headings.
- [x] Audit twelve routes at desktop and 375 px for heading order, control labelling, image and SVG semantics, div density, real horizontal overflow, and contrast.

### Audit result

Twelve routes, zero findings: one `<h1>` each, no skipped heading levels, no unlabelled form control, no control without an accessible name, no image without `alt`, no icon exposed to assistive technology, no page that scrolls sideways at 375 px. Div density ranges from 11/95 to 74/408. The only remaining contrast "failures" the sweep reports are colour emoji, where the CSS `color` property does not describe what is painted.

### Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Retuning shared slate tokens changes light mode too | High | Only steps 700-950 moved; 50-600 are Tailwind's originals. |
| A future bulk class edit reintroduces the prefix bug | Medium | The failure and its cause are recorded above; guards belong on the class string. |
| Drivers lose legibility outdoors | Medium | Toggle retained, and the driver screen carries the highest measured ratios in the app. |
| Landing portal drifts from the console | Medium | Landing files are excluded from every bulk script and were verified untouched. |


## Phase 19: Landing parity — one accent across the whole product

### Architecture decisions

- The console adopts the landing portal's accent rather than keeping its own. The portal paints exactly one accent, Tailwind `amber-400` (#fbbf24), and the console carried teal; that single difference was what made the two halves read as separate products.
- Two ordered passes, not one. Warning states moved amber to orange **before** teal became amber, because running the brand swap first would have let the warning pass recolour the freshly branded amber. Order is the whole correctness argument for this edit.
- The brand swap keeps every shade number (`teal-N` to `amber-N`). The light/dark pairings had already been tuned for contrast in Phase 18, so preserving the shade preserves that work; only the handful of buttons that sat on `teal-600` needed a new shade, because white measures 4.0:1 on teal-600 but 3.19:1 on amber-600.
- `--color-cinema-accent` moved from #f0b429 to #fbbf24. The near-match was invisible in isolation but meant the chrome and the portal were two different ambers; they are now literally the same value.
- The `--color-brand-*` ramp, still holding teal hexes from before the project had a settled palette, moved to the amber ramp.
- Warning keeps a distinct hue rather than relying on context alone: orange-300 on dark (10.82:1), orange-800 on light (7.31:1).

### Palette

| Role | Light | Dark | Measured |
| --- | --- | --- | --- |
| Primary action | `bg-amber-700` + white | `bg-amber-400` + slate-950 | 5.02:1 / 10.69:1 |
| Accent text | `text-amber-700` | `text-amber-400` | 5.02:1 / 10.93:1 |
| Focus ring | `amber-600` | `amber-400` | 3.19:1 / 10.93:1 (non-text threshold is 3:1) |
| Warning | `orange-800` | `orange-300` | 7.31:1 / 10.82:1 |

### Task list

- [x] Extract the portal's palette and confirm amber-400 is its only accent.
- [x] Move warning states from amber to orange (130 occurrences, 26 files).
- [x] Swap brand teal to amber (582 occurrences, 51 files), landing excluded.
- [x] Repair the five buttons whose shade no longer carried white text.
- [x] Align `--color-cinema-accent` and the `--color-brand-*` ramp to the portal amber.
- [x] Re-audit twelve routes at desktop and 375 px, in all three roles.

### Audit result

Zero teal pixels remain in the console. The sidebar active link and the page eyebrow both resolve to `rgb(251,191,36)`, byte-identical to the portal's amber-400.

Twelve routes, three roles, desktop and 375 px: one `<h1>` each, no skipped heading level, no unlabelled form control, no control without an accessible name, no image without `alt`, no icon exposed to assistive technology, no page scrolling sideways, and no contrast failure. The only entries the sweep still reports are colour emoji, where the CSS `color` property does not describe what is painted, and one Leaflet-internal element that is always positioned off-screen.

Admin-only routes were verified under an ADMIN session after a DISPATCHER session correctly bounced to `/dashboard` — the redirect is the role guard working, not a broken page.

### Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| A hue swap silently drops text below AA | High | Shade numbers preserved; the five exceptions measured and repaired; every route re-measured in a browser. |
| Warning and brand become indistinguishable | Medium | Warning moved to orange in a separate, earlier pass. |
| The bulk regex catches unintended tokens | Medium | Word-bounded on both sides, so opacity suffixes such as `amber-500/25` survive and no partial token matches. |
| Landing drifts | High | Landing excluded from both passes and verified afterwards; its tests still pass. |


## Phase 20: Portal form language across every screen

### What was actually missing

Phases 17 to 19 matched the palette and left the form alone. The console still
boxed everything in `rounded-2xl` cards with shadows and set headings in
sentence case, while the portal separates blocks with hairlines, squares its
corners and sets headings in wide uppercase. Colour had matched for two phases;
shape had not, which is why the two halves still read as different products.

### Architecture decisions

- `components/ui/Section.tsx` encodes the portal's layout vocabulary once —
  `SectionHeading`, `HairlineGrid`, `HairlineCell`, `DataFrame`, `GhostAction`,
  `PrimaryAction`, `BlockTitle`. Rolling out to eleven more screens became
  assembly rather than design.
- Hybrid depth, as chosen: chrome, headings, tiles and counters go flat and
  hairline; tables and forms keep a square hairline frame, because a rule alone
  stops guiding the eye once rows get dense.
- Radius and shadow were collapsed in one mechanical pass. Neither carries
  contrast, so the change is visually large and free of accessibility risk.
  `rounded-full` was excluded: avatars and status dots stay circular.
- Heading case was **not** applied blanket. A person's name or an order code in
  wide uppercase reads as shouting, and Vietnamese diacritics get harder at wide
  tracking, so dialogs, item detail panels and the printed bill keep sentence
  case. Two headings that slipped through — a customer name and a driver name —
  were reverted after review.
- Sign-in takes the portal's ground rather than a saturated amber slab. It is
  the hinge between the public page and the console, and the old slab also put
  its body copy at 3.42:1 with no colour that could fix it: even white measured
  3.19:1 against the panel's lighter end.
- The palette was softened toward the reference's subdued tone: grounds lifted
  off pure black, accent moved from neon `#fbbf24` to bronze `#e8a838`.
  Redefining `--color-amber-400` rather than renaming classes meant the portal
  and the console softened together with no bulk edit to regress.

### Defects found and fixed

| Defect | Measured | Where it came from |
| --- | --- | --- |
| Chart series still teal | 4.45:1 legend | hex in JS, invisible to the class-level swap |
| Tracking timeline check mark | **2.08:1** | `dark:bg-amber-400` with white text |
| Sign-in body copy | 3.42:1 | saturated amber panel |
| Map polyline and route palette | — | same hex-in-JS blind spot |

### Two measurement mistakes, both mine

- Reading `getComputedStyle().color` with a regex reported the hero service note
  at 1.19:1. Tailwind v4 emits `lab()`, so the regex read LAB coordinates as
  RGB. Resolved through canvas it measures 12.05:1 — nothing was wrong. This is
  pitfall 5.1 in `PHASE-16-HANDOFF.md`, written down and still walked into.
- Filtering "emoji" out of contrast results with a range that included U+2713
  hid a real 2.08:1 failure. Only U+1F300 and above are colour emoji, where the
  CSS colour says nothing about what is painted; `✓` and `⚠` are ordinary glyphs
  and must be measured.

### Audit result

Thirteen routes across three roles, desktop 1351 px and mobile 375 px: one
`<h1>` each, no skipped heading level, no unlabelled control, no control without
an accessible name, no image without `alt`, no page scrolling sideways, and no
contrast failure. Div density runs 10/67 to 74/420.

Two residual reports are not defects: colour emoji, and Leaflet's internal
`leaflet-overlay-pane` SVG, which the library renders without `aria-hidden` and
which contains no announced content.

### Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Blanket uppercase damages readability | Medium | Dialogs, names and printed output excluded; two slips caught on review. |
| A colour set in JS escapes a class-level swap | High | Swept the hex values directly; `grep` for the old brand hexes now returns zero. |
| An emoji filter hides a real failure | High | Filter narrowed to U+1F300+; earlier pages re-audited with the corrected filter. |
| Squaring corners breaks a circular element | Low | `rounded-full` excluded and verified: 75 instances intact. |
