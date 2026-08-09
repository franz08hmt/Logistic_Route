from collections import Counter

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.models import (
    CustomerNotification,
    Order,
    OrderStatus,
    RouteAnalyticsSnapshot,
    User,
    UserRole,
    UserStatus,
    Vehicle,
    VehicleStatus,
)
from app.schemas import ScenarioType
from app.services import scenario_loader
from app.services.scenario_loader import load_demo_scenario


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


def test_hcmc_scenario_replaces_operations_with_complete_demo_dataset(
    db: Session,
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    retained_user = User(
        email="portfolio.owner@test.vn",
        hashed_password="preserved",
        full_name="Portfolio Owner",
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
    )
    db.add(retained_user)
    db.commit()
    monkeypatch.setattr(scenario_loader, "POD_UPLOAD_DIR", tmp_path / "pod")
    monkeypatch.setattr(
        scenario_loader,
        "SIGNATURE_UPLOAD_DIR",
        tmp_path / "signatures",
    )

    result = load_demo_scenario(db, ScenarioType.HCMC_PEAK_DAY)

    assert result.scenario_name == "HCMC_PEAK_DAY"
    assert result.vehicles_loaded == 3
    assert result.orders_loaded == 12
    assert result.delivered_orders == 4
    assert result.active_telemetry_vehicles == 2
    assert db.scalar(select(func.count()).select_from(RouteAnalyticsSnapshot)) == 14
    assert db.scalar(select(func.count()).select_from(CustomerNotification)) >= 4
    assert db.scalar(
        select(func.count()).select_from(User).where(User.email == retained_user.email)
    ) == 1

    vehicles = list(db.scalars(select(Vehicle).order_by(Vehicle.license_plate)).all())
    assert [(item.license_plate, item.capacity_kg) for item in vehicles] == [
        ("51D-12001", 1200),
        ("51D-12002", 1000),
        ("51D-12003", 1500),
    ]
    assert sum(vehicle.status is VehicleStatus.ON_ROUTE for vehicle in vehicles) == 2
    assert sum(vehicle.last_gps_ping_at is not None for vehicle in vehicles) == 2

    orders = list(db.scalars(select(Order)).all())
    assert Counter(order.status for order in orders) == {
        OrderStatus.DELIVERED: 4,
        OrderStatus.DELIVERING: 2,
        OrderStatus.PENDING: 6,
    }
    delivered = [order for order in orders if order.status is OrderStatus.DELIVERED]
    assert all(order.pod_url and order.signature_url for order in delivered)
    assert all(order.recipient_name for order in delivered)
    pending = [order for order in orders if order.status is OrderStatus.PENDING]
    assert all(order.assigned_vehicle_id is None for order in pending)


def test_scenario_reload_is_deterministic_and_does_not_duplicate_rows(
    db: Session,
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(scenario_loader, "POD_UPLOAD_DIR", tmp_path / "pod")
    monkeypatch.setattr(
        scenario_loader,
        "SIGNATURE_UPLOAD_DIR",
        tmp_path / "signatures",
    )

    first = load_demo_scenario(db, ScenarioType.HCMC_PEAK_DAY)
    second = load_demo_scenario(db, ScenarioType.HCMC_PEAK_DAY)

    assert first.orders_loaded == second.orders_loaded == 12
    assert db.scalar(select(func.count()).select_from(Order)) == 12
    assert db.scalar(select(func.count()).select_from(Vehicle)) == 3
    assert db.scalar(select(func.count()).select_from(RouteAnalyticsSnapshot)) == 14


def test_scenario_loader_rolls_back_operational_reset_on_failure(
    db: Session,
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    existing = Order(
        order_code="KEEP-ON-ROLLBACK",
        customer_name="Existing Customer",
        address="Existing address",
        latitude=10.77,
        longitude=106.70,
        weight_kg=10,
        status=OrderStatus.PENDING,
    )
    db.add(existing)
    db.commit()
    monkeypatch.setattr(scenario_loader, "POD_UPLOAD_DIR", tmp_path / "pod")
    monkeypatch.setattr(
        scenario_loader,
        "SIGNATURE_UPLOAD_DIR",
        tmp_path / "signatures",
    )

    def fail_after_reset(*args, **kwargs):
        raise RuntimeError("simulated scenario generation failure")

    monkeypatch.setattr(scenario_loader, "_create_scenario_orders", fail_after_reset)

    with pytest.raises(RuntimeError, match="simulated scenario generation failure"):
        load_demo_scenario(db, ScenarioType.HCMC_PEAK_DAY)

    assert db.scalar(
        select(func.count()).select_from(Order).where(
            Order.order_code == "KEEP-ON-ROLLBACK"
        )
    ) == 1
