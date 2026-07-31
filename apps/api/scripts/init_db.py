from sqlalchemy import text

from app.db.base import Base
from app.db.models import (  # noqa: F401 - register ORM tables
    Depot,
    Order,
    OrderActivityLog,
    RouteAnalyticsSnapshot,
    User,
    Vehicle,
)
from app.db.session import engine


def main() -> None:
    with engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        Base.metadata.create_all(bind=connection)
        connection.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30)"
        ))
        connection.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(24)"
        ))
        connection.execute(text(
            "UPDATE users SET status = 'ACTIVE' WHERE status IS NULL"
        ))
        connection.execute(text(
            "ALTER TABLE users ALTER COLUMN status "
            "SET DEFAULT 'PENDING_APPROVAL'"
        ))
        connection.execute(text(
            "ALTER TABLE users ALTER COLUMN status SET NOT NULL"
        ))
        connection.execute(text(
            "ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "
            "driver_id UUID REFERENCES users(id) ON DELETE SET NULL"
        ))
        connection.execute(text(
            "ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "
            "vehicle_type VARCHAR(50) DEFAULT 'TRUCK'"
        ))
        connection.execute(text(
            "ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS service_area VARCHAR(150)"
        ))
        connection.execute(text(
            "ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS assignment_note TEXT"
        ))
        connection.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(30)"
        ))
        connection.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS "
            "assigned_vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL"
        ))
        connection.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS stop_sequence INTEGER"
        ))
        connection.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_note TEXT"
        ))
        connection.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS failure_reason TEXT"
        ))
        connection.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS pod_url TEXT"
        ))
        connection.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS pod_uploaded_at TIMESTAMPTZ"
        ))
        connection.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS "
            "status_updated_at TIMESTAMPTZ"
        ))
        connection.execute(text(
            "UPDATE orders SET status_updated_at = pod_uploaded_at "
            "WHERE status_updated_at IS NULL AND pod_uploaded_at IS NOT NULL"
        ))
        connection.execute(text(
            "ALTER TABLE orders ALTER COLUMN status_updated_at SET DEFAULT NOW()"
        ))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_orders_status_updated_at "
            "ON orders (status_updated_at)"
        ))
        connection.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS "
            "delivery_region VARCHAR(150)"
        ))
        connection.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS route_batch_id UUID"
        ))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_orders_route_batch_id "
            "ON orders (route_batch_id)"
        ))
        connection.execute(text(
            "UPDATE vehicles SET status = 'IDLE' "
            "WHERE status = 'ON_ROUTE' AND NOT EXISTS ("
            "SELECT 1 FROM orders "
            "WHERE orders.assigned_vehicle_id = vehicles.id "
            "AND orders.status IN ('PENDING', 'ASSIGNED', 'DELIVERING'))"
        ))
    print("Database schema is ready.")


if __name__ == "__main__":
    main()
