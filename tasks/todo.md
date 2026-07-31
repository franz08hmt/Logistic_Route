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
