from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Depot


def resolve_depot(db: Session, depot_id: UUID | None) -> Depot | None:
    """Resolve an explicit depot or the deterministic operational default."""
    if depot_id is not None:
        depot = db.get(Depot, depot_id)
        if depot is None:
            raise HTTPException(status_code=404, detail="Depot not found")
        return depot

    return db.scalar(
        select(Depot)
        .order_by(Depot.is_default.desc(), Depot.code, Depot.id)
        .limit(1)
    )
