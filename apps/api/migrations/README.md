# Database migrations

The current bootstrap migration is intentionally small and executable without
Alembic. Run `python -m scripts.init_db` from `apps/api` after starting the
PostGIS container. It enables the PostGIS extension and creates the `depots`,
`users`, `vehicles`, `orders`, and `route_analytics_snapshots` tables if they do
not exist. It also adds the
Driver Workspace columns (`vehicles.driver_id`, `orders.assigned_vehicle_id`,
`orders.stop_sequence`, `orders.customer_phone`, `orders.delivery_note`,
`orders.failure_reason`, and `orders.pod_url`) to an existing local database.
Migration `002_user_approval.sql` adds `users.phone_number` and `users.status`.
Existing accounts are migrated to `ACTIVE`; newly registered accounts default
to `PENDING_APPROVAL`.
Migration `003_vehicle_assignment.sql` adds `vehicles.vehicle_type`,
`vehicles.service_area`, and `vehicles.assignment_note` for the driver vehicle
assignment workflow.
Migration `004_dispatch_and_pod.sql` adds the normalized delivery region used
by manual driver assignment and region mismatch checks. POD image files are
stored outside the database under the configured `POD_UPLOAD_DIR`.
Migration `005_reconcile_vehicle_availability.sql` repairs legacy `ON_ROUTE`
vehicles that have no pending, assigned, or delivering orders. New driver
status updates perform this reconciliation in the same transaction.
Migration `006_order_route_batch.sql` groups assigned stops into a dispatch
batch so the Driver Workspace can show the current trip without counting
completed stops from historical trips.
Migration `007_pod_uploaded_at.sql` records when a proof-of-delivery image was
stored so dispatchers can audit successful and failed delivery evidence.
Migration `008_order_status_updated_at.sql` records the latest status transition
time used by the driver operations dashboard for reliable daily delivery and
failure counts.
Migration `009_vehicle_telemetry.sql` stores the latest GPS position, speed,
ping timestamp, and route-deviation classification for each vehicle. It also
indexes GPS freshness checks used by the dispatcher telemetry endpoint.
Migration `010_customer_notifications.sql` stores simulated Zalo ZNS and SMS
Brandname delivery messages. Notification records are deleted automatically
when their parent order is deleted.
The local container is
published on host port `5433` so it does not collide with another PostgreSQL
instance on host port `5432`.

When schema changes become frequent, introduce Alembic and replace
`Base.metadata.create_all()` with versioned revisions.
