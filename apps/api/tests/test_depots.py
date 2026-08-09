from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1.depots import create_depot, list_depots, update_depot
from app.db.base import Base
from app.db.models import Depot, Order, User, UserRole, UserStatus, Vehicle
from app.schemas import DepotCreate, DepotUpdate
from app.services.depot_scope import resolve_depot


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


def _admin(db: Session) -> User:
    user = User(
        email="admin@depots.test",
        hashed_password="not-used",
        full_name="Depot Admin",
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.flush()
    return user


def _payload(*, code: str, is_default: bool = False) -> DepotCreate:
    return DepotCreate(
        code=code,
        name=f"Depot {code}",
        city="Test City",
        address="1 Logistics Road",
        latitude=10.0,
        longitude=106.0,
        is_default=is_default,
    )


def test_multi_depot_columns_and_foreign_keys_are_registered() -> None:
    assert Depot.__table__.c.code.unique is True
    assert Depot.__table__.c.code.index is True
    assert Depot.__table__.c.city.nullable is False
    assert Depot.__table__.c.is_default.nullable is False
    assert Vehicle.__table__.c.depot_id.nullable is True
    assert Order.__table__.c.depot_id.nullable is True

    vehicle_fks = inspect(Vehicle.__table__).foreign_keys
    order_fks = inspect(Order.__table__).foreign_keys
    assert any(fk.target_fullname == "depots.id" for fk in vehicle_fks)
    assert any(fk.target_fullname == "depots.id" for fk in order_fks)


def test_create_first_depot_makes_it_default_and_normalizes_code(db: Session) -> None:
    admin = _admin(db)

    created = create_depot(
        payload=_payload(code=" hub-sgn "),
        db=db,
        _current_user=admin,
    )

    assert created.code == "HUB-SGN"
    assert created.is_default is True
    assert resolve_depot(db, None).id == created.id


def test_setting_a_new_default_unsets_the_previous_default(db: Session) -> None:
    admin = _admin(db)
    first = create_depot(
        payload=_payload(code="HUB-SGN", is_default=True),
        db=db,
        _current_user=admin,
    )
    second = create_depot(
        payload=_payload(code="HUB-HAN", is_default=True),
        db=db,
        _current_user=admin,
    )

    persisted_first = db.get(Depot, first.id)
    assert persisted_first is not None
    assert persisted_first.is_default is False
    assert second.is_default is True
    assert resolve_depot(db, None).id == second.id


def test_list_depots_returns_operational_aggregates(db: Session) -> None:
    admin = _admin(db)
    depot = create_depot(
        payload=_payload(code="HUB-SGN"),
        db=db,
        _current_user=admin,
    )
    db.add_all(
        [
            Vehicle(
                license_plate="51D-DEPOT-1",
                capacity_kg=900,
                depot_id=depot.id,
            ),
            Vehicle(
                license_plate="51D-DEPOT-2",
                capacity_kg=1100,
                depot_id=depot.id,
            ),
            Order(
                order_code="DEPOT-ORDER",
                customer_name="Customer",
                address="Address",
                latitude=10.1,
                longitude=106.1,
                weight_kg=20,
                depot_id=depot.id,
            ),
        ]
    )
    db.commit()

    result = list_depots(db=db, _current_user=admin)

    assert len(result) == 1
    assert result[0].vehicle_count == 2
    assert result[0].active_orders_count == 1
    assert result[0].total_vehicle_capacity_kg == 2000


def test_update_depot_rejects_unknown_id(db: Session) -> None:
    admin = _admin(db)

    with pytest.raises(HTTPException) as exc_info:
        update_depot(
            depot_id=uuid4(),
            payload=DepotUpdate(city="Updated City"),
            db=db,
            _current_user=admin,
        )

    assert exc_info.value.status_code == 404


def test_explicit_depot_scope_rejects_unknown_id(db: Session) -> None:
    with pytest.raises(HTTPException) as exc_info:
        resolve_depot(db, uuid4())

    assert exc_info.value.status_code == 404


def test_depot_codes_are_unique(db: Session) -> None:
    admin = _admin(db)
    create_depot(payload=_payload(code="HUB-SGN"), db=db, _current_user=admin)

    with pytest.raises(HTTPException) as exc_info:
        create_depot(payload=_payload(code="hub-sgn"), db=db, _current_user=admin)

    assert exc_info.value.status_code == 409
    assert db.scalar(select(Depot).where(Depot.code == "HUB-SGN")) is not None
