from sqlalchemy import text

from app.db.base import Base
from app.db.models import Depot, Order, User, Vehicle  # noqa: F401 - register ORM tables
from app.db.session import engine


def main() -> None:
    with engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        Base.metadata.create_all(bind=connection)
        connection.execute(text(
            "ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "
            "driver_id UUID REFERENCES users(id) ON DELETE SET NULL"
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
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS pod_url TEXT"
        ))
    print("Database schema is ready.")


if __name__ == "__main__":
    main()
