from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1.admin import assign_vehicle, list_users, update_user_status
from app.api.v1.auth import login, register
from app.api.v1.driver import get_driver_route
from app.core.security import get_password_hash, require_roles
from app.db.base import Base
from app.db.models import Depot, User, UserRole, UserStatus, Vehicle, VehicleStatus
from app.main import app
from app.schemas import (
    LoginRequest,
    RegisterRequest,
    UserRead,
    UserStatusUpdate,
    VehicleAssignmentRequest,
)


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


def create_active_user(
    db: Session,
    *,
    email: str,
    role: UserRole,
) -> User:
    user = User(
        email=email,
        hashed_password=get_password_hash("123456"),
        full_name="Test User",
        role=role,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_register_creates_pending_account_without_exposing_password(db: Session) -> None:
    result = register(
        RegisterRequest(
            full_name="Nguyen Van Tai",
            email=" New.Driver@LogiRoute.vn ",
            password="123456",
            phone_number="0901234567",
            role=UserRole.DRIVER,
        ),
        db,
    )

    persisted = db.scalar(select(User).where(User.email == "new.driver@logiroute.vn"))
    assert persisted is not None
    assert persisted.hashed_password != "123456"
    public_result = UserRead.model_validate(result).model_dump()
    assert public_result["status"] is UserStatus.PENDING_APPROVAL
    assert public_result["phone_number"] == "0901234567"
    assert "hashed_password" not in public_result


def test_register_rejects_duplicate_email(db: Session) -> None:
    payload = RegisterRequest(
        full_name="First User",
        email="duplicate@logiroute.vn",
        password="123456",
        role=UserRole.DISPATCHER,
    )
    register(payload, db)

    with pytest.raises(HTTPException) as error:
        register(payload, db)

    assert error.value.status_code == 409


def test_register_rejects_admin_role() -> None:
    with pytest.raises(ValueError):
        RegisterRequest(
            full_name="Unauthorized Admin",
            email="not-admin@logiroute.vn",
            password="123456",
            role=UserRole.ADMIN,
        )


def test_register_rejects_a_whitespace_only_name() -> None:
    with pytest.raises(ValueError):
        RegisterRequest(
            full_name="   ",
            email="valid@logiroute.vn",
            password="123456",
            role=UserRole.DRIVER,
        )


def test_pending_account_cannot_login_until_admin_approves_it(db: Session) -> None:
    pending = register(
        RegisterRequest(
            full_name="Pending Dispatcher",
            email="pending@logiroute.vn",
            password="123456",
            role=UserRole.DISPATCHER,
        ),
        db,
    )

    with pytest.raises(HTTPException) as error:
        login(LoginRequest(email=pending.email, password="123456"), db)

    assert error.value.status_code == 403
    assert error.value.detail == "Tài khoản của bạn đang chờ Admin phê duyệt"


def test_dispatcher_can_list_but_only_admin_can_update_users(db: Session) -> None:
    admin = create_active_user(db, email="admin@test.vn", role=UserRole.ADMIN)
    dispatcher = create_active_user(
        db,
        email="dispatcher@test.vn",
        role=UserRole.DISPATCHER,
    )
    with pytest.raises(HTTPException) as forbidden:
        require_roles(UserRole.ADMIN)(current_user=dispatcher)
    assert forbidden.value.status_code == 403

    pending = register(
        RegisterRequest(
            full_name="Pending Driver",
            email="pending-driver@test.vn",
            password="123456",
            role=UserRole.DRIVER,
        ),
        db,
    )

    users = list_users(db=db, _current_user=admin)
    assert [user.email for user in users] == [
        "admin@test.vn",
        "dispatcher@test.vn",
        "pending-driver@test.vn",
    ]
    dispatcher_users = list_users(db=db, _current_user=dispatcher)
    assert [user.email for user in dispatcher_users] == [
        "admin@test.vn",
        "dispatcher@test.vn",
        "pending-driver@test.vn",
    ]

    approved = update_user_status(
        user_id=pending.id,
        payload=UserStatusUpdate(status=UserStatus.ACTIVE),
        db=db,
        _current_user=admin,
    )
    assert approved.status is UserStatus.ACTIVE
    assert login(
        LoginRequest(email=pending.email, password="123456"),
        db,
    ).access_token

    with pytest.raises(HTTPException) as error:
        update_user_status(
            user_id=uuid4(),
            payload=UserStatusUpdate(status=UserStatus.SUSPENDED),
            db=db,
            _current_user=admin,
        )
    assert error.value.status_code == 404


def test_admin_can_assign_an_available_vehicle_to_an_active_driver(db: Session) -> None:
    admin = create_active_user(db, email="admin-assign@test.vn", role=UserRole.ADMIN)
    driver = create_active_user(db, email="driver-assign@test.vn", role=UserRole.DRIVER)
    vehicle = Vehicle(
        license_plate="51D-ASSIGN",
        capacity_kg=900,
        driver_name=None,
        status=VehicleStatus.IDLE,
    )
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)

    assigned = assign_vehicle(
        user_id=driver.id,
        payload=VehicleAssignmentRequest(
            vehicle_id=vehicle.id,
            service_area="Quan 12",
            assignment_note="Nhận hàng lúc 07:00",
        ),
        db=db,
        _current_user=admin,
    )

    assert assigned.id == driver.id
    db.refresh(vehicle)
    assert vehicle.driver_id == driver.id
    assert vehicle.driver_name == driver.full_name
    assert vehicle.service_area == "Quan 12"
    assert vehicle.assignment_note == "Nhận hàng lúc 07:00"


def test_driver_without_vehicle_gets_a_valid_empty_route(db: Session) -> None:
    driver = create_active_user(db, email="unassigned@test.vn", role=UserRole.DRIVER)
    db.add(
        Depot(
            name="Test Depot",
            address="Quan 12",
            latitude=10.86,
            longitude=106.65,
        )
    )
    db.commit()

    route = get_driver_route(db=db, current_user=driver)

    assert route.vehicle is None
    assert route.total_orders == 0
    assert route.stops == []


def test_registration_and_admin_contracts_are_exposed_in_openapi() -> None:
    paths = app.openapi()["paths"]

    assert "post" in paths["/api/v1/auth/register"]
    assert "get" in paths["/api/v1/admin/users"]
    assert "patch" in paths["/api/v1/admin/users/{user_id}/status"]
    assert "patch" in paths["/api/v1/admin/users/{user_id}/vehicle"]
    assert paths["/api/v1/admin/users"]["get"]["security"]
