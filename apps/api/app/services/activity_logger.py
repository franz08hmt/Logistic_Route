from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import OrderActivityLog, User


def log_order_activity(
    db: Session,
    *,
    order_id: UUID,
    action: str,
    actor: User | None = None,
    old_status: str | None = None,
    new_status: str | None = None,
    detail: str | None = None,
) -> None:
    """Queue one order audit event in the caller's active transaction."""
    db.add(
        OrderActivityLog(
            order_id=order_id,
            action=action,
            old_status=old_status,
            new_status=new_status,
            actor_id=actor.id if actor else None,
            actor_name=actor.full_name if actor else None,
            actor_role=actor.role.value if actor else None,
            detail=detail,
            created_at=datetime.now(timezone.utc),
        )
    )
