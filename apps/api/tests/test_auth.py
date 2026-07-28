from uuid import uuid4

from app.db.models import UserRole
from app.main import app
from app.schemas import LoginRequest
from app.core.security import (
    create_access_token,
    decode_access_token,
    get_password_hash,
    verify_password,
)


def test_password_hash_is_not_plaintext_and_verifies() -> None:
    password = "local-test-password"
    hashed_password = get_password_hash(password)

    assert hashed_password != password
    assert verify_password(password, hashed_password)
    assert not verify_password("wrong-password", hashed_password)


def test_access_token_contains_user_subject_and_role() -> None:
    user_id = uuid4()

    token = create_access_token(user_id, UserRole.DISPATCHER)
    claims = decode_access_token(token)

    assert claims["sub"] == str(user_id)
    assert claims["role"] == UserRole.DISPATCHER.value
    assert "exp" in claims


def test_login_schema_rejects_short_credentials() -> None:
    try:
        LoginRequest(email="a", password="123")
    except ValueError:
        return

    raise AssertionError("LoginRequest should reject invalid credentials")


def test_protected_endpoints_publish_bearer_security_scheme() -> None:
    openapi = app.openapi()

    for path in (
        "/api/v1/orders",
        "/api/v1/vehicles",
        "/api/v1/routes/optimize",
        "/api/v1/orders/{order_id}/status",
    ):
        methods = openapi["paths"][path]
        assert any("security" in operation for operation in methods.values())
