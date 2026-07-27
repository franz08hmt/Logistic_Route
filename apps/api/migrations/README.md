# Database migrations

The current bootstrap migration is intentionally small and executable without
Alembic. Run `python scripts/init_db.py` from `apps/api` after starting the
PostGIS container. It enables the PostGIS extension and creates the `depots`,
`vehicles`, and `orders` tables if they do not exist. The local container is
published on host port `5433` so it does not collide with another PostgreSQL
instance on host port `5432`.

When schema changes become frequent, introduce Alembic and replace
`Base.metadata.create_all()` with versioned revisions.
