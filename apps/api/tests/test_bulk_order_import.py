import asyncio
from io import BytesIO

import pytest
from fastapi import HTTPException, UploadFile
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.v1.orders import (
    MAX_CSV_IMPORT_BYTES,
    download_order_import_template,
    import_orders,
)
from app.core.security import get_password_hash
from app.db.base import Base
from app.db.models import (
    Order,
    OrderActivityLog,
    OrderStatus,
    User,
    UserRole,
    UserStatus,
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


@pytest.fixture
def dispatcher(db: Session) -> User:
    user = User(
        email="bulk.dispatcher@test.vn",
        hashed_password=get_password_hash("123456"),
        full_name="Bulk Dispatcher",
        role=UserRole.DISPATCHER,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def upload(content: bytes, filename: str = "orders.csv") -> UploadFile:
    return UploadFile(file=BytesIO(content), filename=filename)


def run_import(
    content: bytes,
    db: Session,
    dispatcher: User,
    *,
    filename: str = "orders.csv",
):
    return asyncio.run(
        import_orders(
            file=upload(content, filename),
            db=db,
            _current_user=dispatcher,
        )
    )


def test_bulk_import_creates_valid_rows_and_reports_invalid_rows(
    db: Session,
    dispatcher: User,
) -> None:
    db.add(
        Order(
            order_code="DB-DUPLICATE",
            customer_name="Existing",
            address="Quan 1",
            latitude=10.77,
            longitude=106.70,
            weight_kg=1,
            status=OrderStatus.PENDING,
        )
    )
    db.commit()
    content = (
        "\ufefforder_code,customer_name,customer_phone,address,latitude,"
        "longitude,weight_kg,delivery_region\r\n"
        'IMPORT-001,Nguyễn Văn A,0901234567,"123 Nguyễn Huệ, Quận 1, TP.HCM",'
        "10.7769,106.7009,15.5,Trung tâm TP.HCM\r\n"
        'IMPORT-BAD,Trần Thị B,,"456 Lê Lợi, Quận 3, TP.HCM",'
        "999,106.6922,8.0,\r\n"
        'DB-DUPLICATE,Lê Văn C,,"1 Pasteur, Quận 1, TP.HCM",'
        "10.77,106.69,4,\r\n"
        'IMPORT-001,Duplicate File,,"2 Pasteur, Quận 1, TP.HCM",'
        "10.77,106.69,4,\r\n"
    ).encode("utf-8")

    result = run_import(content, db, dispatcher)

    assert result.total_rows == 4
    assert result.created_count == 1
    assert result.error_count == 3
    assert [error.row for error in result.errors] == [2, 3, 4]
    assert "latitude" in " ".join(result.errors[0].errors)
    assert result.errors[1].errors == ["order_code already exists"]
    assert result.errors[2].errors == ["duplicate order_code in CSV"]

    created = db.scalar(select(Order).where(Order.order_code == "IMPORT-001"))
    assert created is not None
    assert created.status is OrderStatus.PENDING
    assert created.customer_phone == "0901234567"
    activity = db.scalar(
        select(OrderActivityLog).where(OrderActivityLog.order_id == created.id)
    )
    assert activity is not None
    assert activity.action == "IMPORTED"
    assert activity.actor_id == dispatcher.id
    assert activity.detail == "Imported from CSV"
    assert created.address == "123 Nguyễn Huệ, Quận 1, TP.HCM"


@pytest.mark.parametrize(
    ("content", "filename", "status_code"),
    [
        pytest.param(b"hello", "orders.txt", 400, id="wrong-extension"),
        pytest.param(
            b"order_code,customer_name,address,latitude,longitude,weight_kg\n",
            "orders.csv",
            400,
            id="no-data-rows",
        ),
        pytest.param(
            b"x" * (MAX_CSV_IMPORT_BYTES + 1),
            "orders.csv",
            413,
            id="over-size-limit",
        ),
    ],
)
def test_bulk_import_rejects_invalid_file_level_inputs(
    content: bytes,
    filename: str,
    status_code: int,
    db: Session,
    dispatcher: User,
) -> None:
    with pytest.raises(HTTPException) as error:
        run_import(content, db, dispatcher, filename=filename)

    assert error.value.status_code == status_code


def test_bulk_import_rejects_missing_required_columns(
    db: Session,
    dispatcher: User,
) -> None:
    content = (
        "order_code,customer_name,address,latitude,weight_kg\n"
        "MISSING-001,Customer,Address,10.77,5\n"
    ).encode()

    with pytest.raises(HTTPException) as error:
        run_import(content, db, dispatcher)

    assert error.value.status_code == 400
    assert "longitude" in str(error.value.detail)


def test_bulk_import_allows_optional_columns_to_be_omitted_and_flags_extra_cells(
    db: Session,
    dispatcher: User,
) -> None:
    content = (
        "order_code,customer_name,address,latitude,longitude,weight_kg\n"
        'OPTIONAL-001,Customer,"District 1, HCMC",10.77,106.70,5\n'
        'EXTRA-001,Customer,"District 3, HCMC",10.78,106.68,4,unexpected\n'
    ).encode()

    result = run_import(content, db, dispatcher)

    assert result.created_count == 1
    assert result.error_count == 1
    assert result.errors[0].row == 2
    assert "more values" in result.errors[0].errors[0]
    created = db.scalar(select(Order).where(Order.order_code == "OPTIONAL-001"))
    assert created is not None
    assert created.customer_phone is None
    assert created.delivery_region is None


def test_order_import_template_is_excel_compatible() -> None:
    response = download_order_import_template(_current_user=object())

    assert response.body.startswith(b"\xef\xbb\xbf")
    assert response.media_type == "text/csv"
    assert "attachment" in response.headers["content-disposition"]
    decoded = response.body.decode("utf-8-sig")
    assert decoded.startswith("order_code,customer_name,customer_phone,address")
    assert decoded.count("\n") >= 4
