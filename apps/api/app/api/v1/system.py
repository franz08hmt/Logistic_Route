from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import require_roles
from app.db.models import User, UserRole
from app.db.session import get_db
from app.schemas import SystemDiagnosticsResponse, SystemHealthResponse
from app.services.system_diagnostics import build_system_health, run_diagnostic_suite


router = APIRouter(prefix="/system", tags=["system"])


@router.get("/health", response_model=SystemHealthResponse)
def get_system_health(
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
) -> SystemHealthResponse:
    """Return a fast, aggregate-only snapshot of six operational subsystems."""
    return build_system_health(db)


@router.post("/diagnostics", response_model=SystemDiagnosticsResponse)
def run_system_diagnostics(
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
) -> SystemDiagnosticsResponse:
    """Run five synthetic, non-destructive self-tests on explicit admin request."""
    return run_diagnostic_suite(db)
