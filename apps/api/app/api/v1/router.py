from fastapi import APIRouter

from app.api.v1 import auth, driver, orders, overview, routes, seed, vehicles


router = APIRouter()
router.include_router(auth.router)
router.include_router(overview.router)
router.include_router(orders.router)
router.include_router(vehicles.router)
router.include_router(seed.router)
router.include_router(routes.router)
router.include_router(driver.router)
