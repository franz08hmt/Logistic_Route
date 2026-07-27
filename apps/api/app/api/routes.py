from fastapi import APIRouter

router = APIRouter()


@router.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    """Return a small readiness response for local checks and monitoring."""
    return {"status": "ok", "service": "logiroute-api"}
