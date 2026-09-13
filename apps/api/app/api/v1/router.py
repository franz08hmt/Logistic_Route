from fastapi import APIRouter

from app.api.v1 import (
    admin,
    analytics,
    auth,
    cod,
    depots,
    driver,
    orders,
    overview,
    routes,
    seed,
    system,
    vehicles,
)


router = APIRouter()
router.include_router(auth.router)
router.include_router(depots.router)
router.include_router(cod.router)
router.include_router(admin.router)
router.include_router(analytics.router)
router.include_router(overview.router)
router.include_router(orders.router)
router.include_router(orders.public_router)
router.include_router(vehicles.router)
router.include_router(seed.router)
router.include_router(routes.router)
router.include_router(driver.router)
router.include_router(system.router)
