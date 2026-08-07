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
