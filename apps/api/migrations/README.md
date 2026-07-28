# Database migrations

The current bootstrap migration is intentionally small and executable without
Alembic. Run `python scripts/init_db.py` from `apps/api` after starting the
PostGIS container. It enables the PostGIS extension and creates the `depots`,
`users`, `vehicles`, and `orders` tables if they do not exist. It also adds the
Driver Workspace columns (`vehicles.driver_id`, `orders.assigned_vehicle_id`,
`orders.stop_sequence`, `orders.customer_phone`, `orders.delivery_note`,
`orders.failure_reason`, and `orders.pod_url`) to an existing local database.
The local container is
published on host port `5433` so it does not collide with another PostgreSQL
instance on host port `5432`.

When schema changes become frequent, introduce Alembic and replace
`Base.metadata.create_all()` with versioned revisions.
