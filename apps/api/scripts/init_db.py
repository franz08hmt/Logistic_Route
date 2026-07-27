from sqlalchemy import text

from app.db.base import Base
from app.db.models import Depot, Order, Vehicle  # noqa: F401 - register ORM tables
from app.db.session import engine


def main() -> None:
    with engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        Base.metadata.create_all(bind=connection)
    print("Database schema is ready.")


if __name__ == "__main__":
    main()
