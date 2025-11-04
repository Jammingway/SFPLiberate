"""FastAPI application with modern patterns."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

from app.config import get_settings
from app.core.database import init_db
from app.core.logging import setup_logging
from app.api.v1.router import api_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager (replaces deprecated on_event).

    Handles startup and shutdown logic.
    """
    # Startup
    setup_logging(settings.log_level, settings.log_json)
    logger = structlog.get_logger()
    logger.info("application_startup", version=settings.version)

    await init_db()
    logger.info("database_initialized")

    # Start ESPHome proxy service if enabled
    if settings.esphome_proxy_mode:
        try:
            from app.services.esphome import ESPHomeProxyService
            service = ESPHomeProxyService()
            await service.start()
            logger.info("esphome_proxy_service_started")
        except Exception as e:
            logger.error("esphome_proxy_service_startup_failed", error=str(e))

    yield

    # Shutdown
    if settings.esphome_proxy_mode:
        try:
            from app.services.esphome import ESPHomeProxyService
            service = ESPHomeProxyService()
            await service.stop()
            logger.info("esphome_proxy_service_stopped")
        except Exception as e:
            logger.error("esphome_proxy_service_shutdown_failed", error=str(e))

    logger.info("application_shutdown")


app = FastAPI(
    title=settings.project_name,
    version=settings.version,
    lifespan=lifespan,
    openapi_url=f"{settings.api_v1_prefix}/openapi.json",
    docs_url=f"{settings.api_v1_prefix}/docs",
    redoc_url=f"{settings.api_v1_prefix}/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 router
app.include_router(api_router, prefix=settings.api_v1_prefix)


# Backward compatibility: Keep legacy /api routes
@app.get("/api/modules")
async def legacy_get_modules():
    """Legacy endpoint - redirects to v1."""
    from fastapi.responses import RedirectResponse

    return RedirectResponse(url=f"{settings.api_v1_prefix}/modules")


@app.get("/health")
async def health_check():
    """Root health check."""
    return {"status": "healthy", "version": settings.version}


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.project_name,
        "version": settings.version,
        "docs_url": f"{settings.api_v1_prefix}/docs",
    }
