from datetime import datetime, timedelta, timezone

import pytest
from pydantic import TypeAdapter
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1.admin import get_driver_performance
from app.api.v1.seed import seed_data
from app.db.base import Base
from app.db.models import (
    Depot,
    Order,
    OrderStatus,
    User,
    UserRole,
    UserStatus,
    Vehicle,
    VehicleStatus,
)
from app.main import app
from app.services.driver_performance import build_driver_performance_report


@pytest.fixture
def db() -> Session:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def _driver(db: Session, name: str, email: str) -> User:
    driver = User(
        email=email,
        hashed_password="unused",
        full_name=name,
        phone_number="0901234567",
        role=UserRole.DRIVER,
        status=UserStatus.ACTIVE,
    )
    db.add(driver)
    db.flush()
    return driver


def _terminal_order(
    db: Session,
    *,
    code: str,
    depot: Depot,
    vehicle: Vehicle,
    status: OrderStatus,
    updated_at: datetime,
    latitude: float,
    longitude: float,
) -> None:
    db.add(
        Order(
            depot_id=depot.id,
            order_code=code,
            customer_name=f"Customer {code}",
            address=f"Address {code}",
            latitude=latitude,
            longitude=longitude,
            weight_kg=10,
            status=status,
            status_updated_at=updated_at,
            assigned_vehicle_id=vehicle.id,
            stop_sequence=1,
        )
    )


def test_performance_report_counts_terminal_orders_and_ranks_deterministically(
    db: Session,
) -> None:
    now = datetime(2026, 8, 9, 12, tzinfo=timezone.utc)
    sgn = Depot(
        code="HUB-SGN",
        name="Southern Hub",
        city="Ho Chi Minh City",
        address="District 12",
        latitude=10.8671,
        longitude=106.6412,
        is_default=True,
    )
    han = Depot(
        code="HUB-HAN",
        name="Northern Hub",
        city="Ha Noi",
        address="Long Bien",
        latitude=21.0362,
        longitude=105.9015,
        is_default=False,
    )
    db.add_all([sgn, han])
    db.flush()

    gold_driver = _driver(db, "An Driver", "an@performance.test")
    silver_driver = _driver(db, "Binh Driver", "binh@performance.test")
    bronze_driver = _driver(db, "Cuong Driver", "cuong@performance.test")
    vehicles = [
        Vehicle(
            depot_id=sgn.id,
            license_plate="51D-GOLD",
            capacity_kg=1200,
            vehicle_type="TRUCK",
            driver_id=gold_driver.id,
            driver_name=gold_driver.full_name,
            status=VehicleStatus.IDLE,
            route_deviation_status="ON_ROUTE",
        ),
        Vehicle(
            depot_id=sgn.id,
            license_plate="51D-SILVER",
            capacity_kg=900,
            vehicle_type="VAN",
            driver_id=silver_driver.id,
            driver_name=silver_driver.full_name,
            status=VehicleStatus.IDLE,
            route_deviation_status="STOPPED",
        ),
        Vehicle(
            depot_id=han.id,
            license_plate="29H-BRONZE",
            capacity_kg=700,
            vehicle_type="TRUCK",
            driver_id=bronze_driver.id,
            driver_name=bronze_driver.full_name,
            status=VehicleStatus.IDLE,
            route_deviation_status="OFF_ROUTE_WARNING",
        ),
    ]
    db.add_all(vehicles)
    db.flush()

    for index in range(10):
        _terminal_order(
            db,
            code=f"GOLD-{index}",
            depot=sgn,
            vehicle=vehicles[0],
            status=OrderStatus.DELIVERED,
            updated_at=now - timedelta(days=index % 5),
            latitude=11.22 + index * 0.01,
            longitude=106.72,
        )
    for index in range(8):
        _terminal_order(
            db,
            code=f"SILVER-{index}",
            depot=sgn,
            vehicle=vehicles[1],
            status=OrderStatus.DELIVERED if index < 6 else OrderStatus.FAILED,
            updated_at=now - timedelta(days=10 + index % 2),
            latitude=10.95 + index * 0.005,
            longitude=106.70,
        )
    for index in range(6):
        _terminal_order(
            db,
            code=f"BRONZE-{index}",
            depot=han,
            vehicle=vehicles[2],
            status=OrderStatus.DELIVERED if index < 3 else OrderStatus.FAILED,
            updated_at=now - timedelta(days=2),
            latitude=21.10 + index * 0.005,
            longitude=105.95,
        )
    _terminal_order(
        db,
        code="GOLD-OUTSIDE-PERIOD",
        depot=sgn,
        vehicle=vehicles[0],
        status=OrderStatus.FAILED,
        updated_at=now - timedelta(days=31),
        latitude=11.0,
        longitude=106.7,
    )
    db.add(
        Order(
            depot_id=sgn.id,
            order_code="ACTIVE-NOT-HANDLED",
            customer_name="Active",
            address="District 1",
            latitude=10.77,
            longitude=106.70,
            weight_kg=10,
            status=OrderStatus.DELIVERING,
            status_updated_at=now,
            assigned_vehicle_id=vehicles[0].id,
        )
    )
    db.commit()

    report = build_driver_performance_report(db, days=30, now=now)

    assert report.period_days == 30
    assert [driver.driver_name for driver in report.drivers] == [
        "An Driver",
        "Binh Driver",
        "Cuong Driver",
    ]
    assert [driver.rank for driver in report.drivers] == [1, 2, 3]
    assert report.drivers[0].delivered_count == 10
    assert report.drivers[0].failed_count == 0
    assert report.drivers[0].success_rate == 100
    assert report.drivers[0].route_adherence_score == 98
    assert report.drivers[1].success_rate == 75
    assert report.drivers[2].success_rate == 50
    assert report.total_co2_saved_all_kg == round(
        sum(driver.estimated_co2_saved_kg for driver in report.drivers),
        3,
    )
    assert all(0 <= driver.overall_score <= 100 for driver in report.drivers)


def test_performance_report_filters_period_and_depot(db: Session) -> None:
    now = datetime(2026, 8, 9, 12, tzinfo=timezone.utc)
    sgn = Depot(
        code="HUB-SGN",
        name="Southern Hub",
        city="Ho Chi Minh City",
        address="District 12",
        latitude=10.8671,
        longitude=106.6412,
        is_default=True,
    )
    han = Depot(
        code="HUB-HAN",
        name="Northern Hub",
        city="Ha Noi",
        address="Long Bien",
        latitude=21.0362,
        longitude=105.9015,
        is_default=False,
    )
    db.add_all([sgn, han])
    db.flush()
    sgn_driver = _driver(db, "SGN Driver", "sgn@performance.test")
    han_driver = _driver(db, "HAN Driver", "han@performance.test")
    sgn_vehicle = Vehicle(
        depot_id=sgn.id,
        license_plate="51D-PERF",
        capacity_kg=1000,
        driver_id=sgn_driver.id,
        driver_name=sgn_driver.full_name,
        status=VehicleStatus.IDLE,
    )
    han_vehicle = Vehicle(
        depot_id=han.id,
        license_plate="29H-PERF",
        capacity_kg=1000,
        driver_id=han_driver.id,
        driver_name=han_driver.full_name,
        status=VehicleStatus.IDLE,
    )
    db.add_all([sgn_vehicle, han_vehicle])
    db.flush()
    _terminal_order(
        db,
        code="SGN-RECENT",
        depot=sgn,
        vehicle=sgn_vehicle,
        status=OrderStatus.DELIVERED,
        updated_at=now - timedelta(days=3),
        latitude=10.77,
        longitude=106.70,
    )
    _terminal_order(
        db,
        code="SGN-OLDER",
        depot=sgn,
        vehicle=sgn_vehicle,
        status=OrderStatus.FAILED,
        updated_at=now - timedelta(days=10),
        latitude=10.80,
        longitude=106.68,
    )
    _terminal_order(
        db,
        code="HAN-RECENT",
        depot=han,
        vehicle=han_vehicle,
        status=OrderStatus.DELIVERED,
        updated_at=now - timedelta(days=1),
        latitude=21.02,
        longitude=105.85,
    )
    db.commit()

    report = build_driver_performance_report(
        db,
        days=7,
        depot_id=sgn.id,
        now=now,
    )

    assert [driver.driver_name for driver in report.drivers] == ["SGN Driver"]
    assert report.drivers[0].total_orders_handled == 1
    assert report.drivers[0].success_rate == 100


def test_driver_performance_endpoint_contract_is_exposed() -> None:
    operation = app.openapi()["paths"]["/api/v1/admin/drivers/performance"]["get"]
    response_schema = app.openapi()["components"]["schemas"]["DriverPerformanceResponse"]

    assert operation["tags"] == ["admin"]
    assert response_schema["properties"]["period_days"]
    days_parameter = next(
        parameter for parameter in operation["parameters"] if parameter["name"] == "days"
    )
    assert days_parameter["schema"]["enum"] == [7, 14, 30]


def test_endpoint_returns_service_response(db: Session) -> None:
    dispatcher = _driver(db, "Dispatcher", "dispatcher@performance.test")
    dispatcher.role = UserRole.DISPATCHER
    db.commit()

    response = get_driver_performance(
        days=30,
        depot_id=None,
        db=db,
        _current_user=dispatcher,
    )

    assert response.period_days == 30
    assert response.drivers == []


def test_endpoint_accepts_supported_period_from_query_string() -> None:
    days_annotation = get_driver_performance.__annotations__["days"]

    assert TypeAdapter(days_annotation).validate_python("14") == 14


def test_seed_creates_idempotent_multi_driver_performance_history(
    db: Session,
) -> None:
    seed_data(db)
    first_history_count = len(
        list(
            db.scalars(
                select(Order).where(Order.order_code.like("LR-PERF-%"))
            ).all()
        )
    )
    seed_data(db)
    second_history_count = len(
        list(
            db.scalars(
                select(Order).where(Order.order_code.like("LR-PERF-%"))
            ).all()
        )
    )
    report = build_driver_performance_report(db, days=30)

    assert first_history_count >= 24
    assert second_history_count == first_history_count
    assert len(report.drivers) >= 3
    assert all(driver.total_orders_handled > 0 for driver in report.drivers[:3])
