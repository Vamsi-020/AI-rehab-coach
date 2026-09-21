"""FastAPI application factory module."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.config import settings
from backend.app.core.exceptions import register_exception_handlers
from backend.app.core.logging import logger
from backend.app.core.middleware import RateLimiterMiddleware, SecurityHeadersMiddleware
from backend.app.database.connection import db_manager
from backend.app.routes.api_v1 import api_v1_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager for startup and shutdown events."""
    logger.info(
        f"Starting {settings.PROJECT_NAME} v{settings.VERSION} [{settings.ENVIRONMENT}]..."
    )
    logger.info(f"CORS origins configured: {settings.BACKEND_CORS_ORIGINS}")

    # Audit JWT Secret key strength
    if "CHANGE_ME" in settings.JWT_SECRET_KEY or len(settings.JWT_SECRET_KEY) < 32:
        logger.warning(
            "SECURITY NOTICE: Default or low-entropy JWT_SECRET_KEY detected. "
            "Ensure a high-entropy secret is configured in backend/.env for production."
        )

    # Initialize async MongoDB connection
    await db_manager.connect()

    yield

    # Cleanly close MongoDB connection
    await db_manager.disconnect()
    logger.info(f"Shutting down {settings.PROJECT_NAME}...")


def create_application() -> FastAPI:
    """Create, configure, and return the FastAPI application instance."""
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="AI Rehabilitation Coach - Physical therapy movement analysis and recovery guidance backend API.",
        openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.DEBUG else None,
        docs_url=f"{settings.API_V1_STR}/docs" if settings.DEBUG else None,
        redoc_url=f"{settings.API_V1_STR}/redoc" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    # Register Security Middlewares (OWASP response headers + in-memory rate limiting)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimiterMiddleware)

    # Configure hardened CORS Middleware
    if settings.BACKEND_CORS_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            allow_headers=["*"],
            expose_headers=["Content-Length", "X-Request-ID"],
        )

    # Register custom and global exception handlers
    register_exception_handlers(app)

    # Legacy & Direct root health check (preserves exact Phase 1 behavior: GET /api/health)
    @app.get(
        "/api/health",
        tags=["Health"],
        summary="Root Health Check",
    )
    def root_health_check():
        return {
            "status": "ok",
            "message": "AI Rehabilitation Coach backend is running",
        }

    # Register API v1 modular router (includes /api/v1/health, /api/v1/..., etc.)
    app.include_router(api_v1_router, prefix=settings.API_V1_STR)

    return app
