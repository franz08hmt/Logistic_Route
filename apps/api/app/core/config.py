from os import getenv
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


API_TITLE = "LogiRoute VN API"
API_VERSION = "0.1.0"
DATABASE_URL = getenv(
    "DATABASE_URL",
    "postgresql+psycopg://logiroute:logiroute_dev_password_change_me@localhost:5433/logiroute",
)
JWT_SECRET_KEY = getenv("JWT_SECRET_KEY", "logiroute-dev-secret-change-me")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
POD_UPLOAD_DIR = Path(
    getenv(
        "POD_UPLOAD_DIR",
        str(Path(__file__).resolve().parents[2] / "uploads" / "pod"),
    )
)
POD_PUBLIC_BASE_URL = getenv(
    "POD_PUBLIC_BASE_URL",
    "http://localhost:8000",
).rstrip("/")
SIGNATURE_UPLOAD_DIR = Path(
    getenv(
        "SIGNATURE_UPLOAD_DIR",
        str(Path(__file__).resolve().parents[2] / "uploads" / "signatures"),
    )
)
SIGNATURE_PUBLIC_BASE_URL = getenv(
    "SIGNATURE_PUBLIC_BASE_URL",
    POD_PUBLIC_BASE_URL,
).rstrip("/")
PUBLIC_TRACKING_BASE_URL = getenv(
    "PUBLIC_TRACKING_BASE_URL",
    "http://localhost:3001",
).rstrip("/")

_default_web_origins = ",".join(
    (
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    )
)
WEB_ORIGINS = [
    origin.strip()
    for origin in getenv("WEB_ORIGINS", getenv("WEB_ORIGIN", _default_web_origins)).split(",")
    if origin.strip()
]

# Default VietQR beneficiary used when a depot has no dedicated bank account.
VIETQR_BANK_CODE = getenv("VIETQR_BANK_CODE", "VCB").strip().upper()
VIETQR_ACCOUNT_NO = getenv("VIETQR_ACCOUNT_NO", "0071001234567").strip()
VIETQR_ACCOUNT_NAME = getenv(
    "VIETQR_ACCOUNT_NAME",
    "CONG TY LOGIROUTE VIET NAM",
).strip()
