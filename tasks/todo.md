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

- [ ] Add authentication and role-based access control.
- [ ] Use a road-network cost matrix and add advanced optimization constraints.
