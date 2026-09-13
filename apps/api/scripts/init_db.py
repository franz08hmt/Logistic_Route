from sqlalchemy import text

from app.db.base import Base
from app.db.models import (  # noqa: F401 - register ORM tables
    CustomerNotification,
    Depot,
    Order,
    OrderActivityLog,
    RouteAnalyticsSnapshot,
    User,
    Vehicle,
)
from app.db.session import engine
from app.services.public_tracking import generate_tracking_token


def main() -> None:
    with engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        orders_table_exists = bool(connection.scalar(text(
            "SELECT to_regclass('public.orders') IS NOT NULL"
        )))
        depots_table_exists = bool(connection.scalar(text(
            "SELECT to_regclass('public.depots') IS NOT NULL"
        )))
        if depots_table_exists:
            connection.execute(text(
                "ALTER TABLE depots ADD COLUMN IF NOT EXISTS code VARCHAR(20)"
            ))
            connection.execute(text(
                "ALTER TABLE depots ADD COLUMN IF NOT EXISTS city VARCHAR(100)"
            ))
            connection.execute(text(
                "ALTER TABLE depots ADD COLUMN IF NOT EXISTS "
                "is_default BOOLEAN DEFAULT FALSE"
            ))
        if orders_table_exists:
            # Add the nullable column before create_all() attempts to create its
            # unique index on an existing orders table.
            connection.execute(text(
                "ALTER TABLE orders ADD COLUMN IF NOT EXISTS "
                "tracking_token VARCHAR(64)"
            ))
        Base.metadata.create_all(bind=connection)
        connection.execute(text(
            "UPDATE depots SET code = 'HUB-SGN', city = 'TP. Hồ Chí Minh', "
            "is_default = TRUE WHERE id = (SELECT id FROM depots ORDER BY id LIMIT 1) "
            "AND code IS NULL"
        ))
        connection.execute(text(
            "UPDATE depots SET code = 'HUB-' || "
            "UPPER(SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 8)), "
            "city = COALESCE(city, 'Chưa phân vùng') WHERE code IS NULL"
        ))
        connection.execute(text(
            "ALTER TABLE depots ALTER COLUMN code SET NOT NULL"
        ))
        connection.execute(text(
            "ALTER TABLE depots ALTER COLUMN city SET NOT NULL"
        ))
        connection.execute(text(
            "ALTER TABLE depots ALTER COLUMN is_default SET NOT NULL"
        ))
        connection.execute(text(
            "UPDATE depots SET is_default = TRUE WHERE id = "
            "(SELECT id FROM depots ORDER BY code, id LIMIT 1) AND NOT EXISTS "
            "(SELECT 1 FROM depots WHERE is_default = TRUE)"
        ))
        connection.execute(text(
            "WITH selected_default AS (SELECT id FROM depots WHERE is_default = TRUE "
            "ORDER BY code, id LIMIT 1) UPDATE depots SET is_default = FALSE "
            "WHERE is_default = TRUE AND id <> (SELECT id FROM selected_default)"
        ))
        connection.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_depots_code ON depots (code)"
        ))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_depots_is_default ON depots (is_default)"
        ))
        connection.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_depots_single_default "
            "ON depots ((is_default)) WHERE is_default = TRUE"
        ))
        missing_tracking_ids = list(connection.scalars(text(
            "SELECT id FROM orders WHERE tracking_token IS NULL"
        )).all())
        for order_id in missing_tracking_ids:
            connection.execute(
                text(
                    "UPDATE orders SET tracking_token = :tracking_token "
                    "WHERE id = :order_id"
                ),
                {
                    "tracking_token": generate_tracking_token(),
                    "order_id": order_id,
                },
            )
        connection.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_orders_tracking_token "
            "ON orders (tracking_token)"
        ))
        connection.execute(text(
            "ALTER TABLE orders ALTER COLUMN tracking_token SET NOT NULL"
        ))
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
            "depot_id UUID REFERENCES depots(id) ON DELETE SET NULL"
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
            "ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "
            "current_latitude DOUBLE PRECISION"
        ))
        connection.execute(text(
            "ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "
            "current_longitude DOUBLE PRECISION"
        ))
        connection.execute(text(
            "ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "
            "current_speed_kmh DOUBLE PRECISION DEFAULT 0"
        ))
        connection.execute(text(
            "ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "
            "last_gps_ping_at TIMESTAMPTZ"
        ))
        connection.execute(text(
            "ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "
            "route_deviation_status VARCHAR(30) DEFAULT 'ON_ROUTE'"
        ))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_vehicles_last_gps_ping_at "
            "ON vehicles (last_gps_ping_at)"
        ))
        connection.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(30)"
        ))
        connection.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS "
            "depot_id UUID REFERENCES depots(id) ON DELETE SET NULL"
        ))
        connection.execute(text(
            "ALTER TABLE route_analytics_snapshots ADD COLUMN IF NOT EXISTS "
            "depot_id UUID REFERENCES depots(id) ON DELETE SET NULL"
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
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS signature_url TEXT"
        ))
        connection.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS "
            "signature_uploaded_at TIMESTAMPTZ"
        ))
        connection.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS "
            "recipient_name VARCHAR(150)"
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
            "UPDATE vehicles SET depot_id = (SELECT id FROM depots "
            "ORDER BY is_default DESC, code LIMIT 1) WHERE depot_id IS NULL"
        ))
        connection.execute(text(
            "UPDATE orders SET depot_id = (SELECT id FROM depots "
            "ORDER BY is_default DESC, code LIMIT 1) WHERE depot_id IS NULL"
        ))
        connection.execute(text(
            "UPDATE route_analytics_snapshots SET depot_id = (SELECT id FROM depots "
            "ORDER BY is_default DESC, code LIMIT 1) WHERE depot_id IS NULL"
        ))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_vehicles_depot_id ON vehicles (depot_id)"
        ))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_orders_depot_id ON orders (depot_id)"
        ))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_route_analytics_snapshots_depot_id "
            "ON route_analytics_snapshots (depot_id)"
        ))
        # Migration 013: COD collection and driver shift cash settlement.
        connection.execute(text(
            "CREATE TABLE IF NOT EXISTS driver_shift_settlements ("
            "id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "
            "settlement_code VARCHAR(50) UNIQUE NOT NULL, "
            "depot_id UUID NOT NULL REFERENCES depots(id) ON DELETE CASCADE, "
            "driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
            "vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE, "
            "total_orders_count INT NOT NULL DEFAULT 0, "
            "delivered_count INT NOT NULL DEFAULT 0, "
            "failed_count INT NOT NULL DEFAULT 0, "
            "total_cod_expected NUMERIC(12, 0) NOT NULL DEFAULT 0, "
            "expected_cash_amount NUMERIC(12, 0) NOT NULL DEFAULT 0, "
            "total_cash_collected NUMERIC(12, 0) NOT NULL DEFAULT 0, "
            "total_vietqr_collected NUMERIC(12, 0) NOT NULL DEFAULT 0, "
            "variance_amount NUMERIC(12, 0) NOT NULL DEFAULT 0, "
            "status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED', "
            "submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), "
            "approved_at TIMESTAMPTZ NULL, "
            "approved_by_id UUID NULL REFERENCES users(id) ON DELETE SET NULL, "
            "notes TEXT NULL, "
            "review_note TEXT NULL)"
        ))
        connection.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS "
            "cod_amount NUMERIC(12, 0) NOT NULL DEFAULT 0"
        ))
        connection.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS "
            "payment_method VARCHAR(20) NOT NULL DEFAULT 'COD_CASH'"
        ))
        connection.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS "
            "cod_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'"
        ))
        connection.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_collected_at TIMESTAMPTZ"
        ))
        connection.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_reconciled_at TIMESTAMPTZ"
        ))
        connection.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_receipt_note TEXT"
        ))
        connection.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS shift_settlement_id UUID "
            "REFERENCES driver_shift_settlements(id) ON DELETE SET NULL"
        ))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_orders_cod_status ON orders (cod_status)"
        ))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_orders_payment_method "
            "ON orders (payment_method)"
        ))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_orders_shift_settlement_id "
            "ON orders (shift_settlement_id)"
        ))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_driver_shift_settlements_scope "
            "ON driver_shift_settlements (depot_id, driver_id, status)"
        ))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_driver_shift_settlements_submitted_at "
            "ON driver_shift_settlements (submitted_at)"
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
