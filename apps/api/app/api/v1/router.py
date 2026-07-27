from fastapi import APIRouter

from app.api.v1 import orders, overview, seed, vehicles


router = APIRouter()
router.include_router(overview.router)
router.include_router(orders.router)
router.include_router(vehicles.router)
router.include_router(seed.router)
