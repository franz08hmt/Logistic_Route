import asyncio
from base64 import b64decode
from io import BytesIO

import pytest
from fastapi import HTTPException, UploadFile
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from starlette.datastructures import Headers

from app.api.v1 import driver as driver_api
from app.core.security import get_password_hash
from app.db.base import Base
from app.db.models import (
    Order,
    OrderActivityLog,
    OrderStatus,
    User,
    UserRole,
    UserStatus,
    Vehicle,
    VehicleStatus,
)
from app.services.signature_storage import validate_signature_content


PNG_CONTENT = b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
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


def active_driver(db: Session, email: str) -> User:
    driver = User(
        email=email,
        hashed_password=get_password_hash("123456"),
        full_name="Tai Huynh",
        role=UserRole.DRIVER,
        status=UserStatus.ACTIVE,
    )
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return driver


def assigned_order(db: Session, driver: User, code: str) -> Order:
    vehicle = Vehicle(
        license_plate=f"51D-{code[-4:]}",
        capacity_kg=1_000,
        driver_id=driver.id,
        driver_name=driver.full_name,
        status=VehicleStatus.ON_ROUTE,
    )
    db.add(vehicle)
    db.flush()
    order = Order(
        order_code=code,
        customer_name="Nguyen Van A",
        address="Quan 1, Ho Chi Minh City",
        latitude=10.7769,
        longitude=106.7009,
        weight_kg=8,
        status=OrderStatus.DELIVERING,
        assigned_vehicle_id=vehicle.id,
        stop_sequence=1,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def png_upload(content: bytes = PNG_CONTENT) -> UploadFile:
    return UploadFile(
        file=BytesIO(content),
        filename="recipient-signature.png",
        headers=Headers({"content-type": "image/png"}),
    )


def test_signature_validation_accepts_png_and_rejects_disguised_content() -> None:
    validate_signature_content(PNG_CONTENT, "image/png")

    with pytest.raises(ValueError, match="PNG"):
        validate_signature_content(b"<script>alert(1)</script>", "image/png")
    with pytest.raises(ValueError, match="PNG"):
        validate_signature_content(PNG_CONTENT, "image/jpeg")


def test_driver_uploads_signature_for_assigned_order(
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    driver = active_driver(db, "signature.driver@test.vn")
    order = assigned_order(db, driver, "SIGNATURE-001")
    monkeypatch.setattr(driver_api, "SIGNATURE_UPLOAD_DIR", tmp_path)
    monkeypatch.setattr(
        driver_api,
        "SIGNATURE_PUBLIC_BASE_URL",
        "http://testserver",
    )

    response = asyncio.run(
        driver_api.upload_order_signature(
            order_id=order.id,
            file=png_upload(),
            recipient_name="  Nguyen Van A  ",
            db=db,
            current_user=driver,
        )
    )

    db.refresh(order)
    assert response.signature_url.startswith(
        "http://testserver/uploads/signatures/"
    )
    assert order.signature_uploaded_at is not None
    assert response.uploaded_at.replace(tzinfo=None) == order.signature_uploaded_at
    assert order.signature_url == response.signature_url
    assert order.recipient_name == "Nguyen Van A"
    assert len(list(tmp_path.glob("*.png"))) == 1
    activity = db.scalar(
        select(OrderActivityLog).where(
            OrderActivityLog.order_id == order.id,
            OrderActivityLog.action == "SIGNATURE_UPLOADED",
        )
    )
    assert activity is not None
    assert activity.actor_id == driver.id


def test_driver_cannot_upload_signature_for_another_driver_order(
    db: Session,
) -> None:
    owner = active_driver(db, "signature.owner@test.vn")
    other_driver = active_driver(db, "signature.other@test.vn")
    order = assigned_order(db, owner, "SIGNATURE-002")

    with pytest.raises(HTTPException) as forbidden:
        asyncio.run(
            driver_api.upload_order_signature(
                order_id=order.id,
                file=png_upload(),
                recipient_name="Nguyen Van A",
                db=db,
                current_user=other_driver,
            )
        )

    assert forbidden.value.status_code == 404
