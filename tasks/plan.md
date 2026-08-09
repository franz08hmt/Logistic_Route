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
