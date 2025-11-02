"""Main API v1 router."""

from fastapi import APIRouter

from app.api.v1 import ble_proxy, health, modules, submissions

api_router = APIRouter()

# Include module routes
api_router.include_router(modules.router, tags=["modules"])

# Include submission routes
api_router.include_router(submissions.router, tags=["submissions"])

# Include health routes
api_router.include_router(health.router, tags=["health"])

# Include BLE proxy routes (optional, requires bleak)
api_router.include_router(ble_proxy.router, prefix="/ble", tags=["ble-proxy"])
