"""Health check endpoint routes."""

from fastapi import APIRouter
from backend.app.core.config import settings
from backend.app.database.connection import db_manager
from backend.app.schemas.health import DatabaseHealth, HealthResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Application & Database Health Check",
    description="Returns the operational status, environment, version, and MongoDB connection status.",
)
async def get_health_status() -> HealthResponse:
    """Return backend operational and database health status."""
    db_health_info = await db_manager.check_health()
    db_health = DatabaseHealth(
        status=db_health_info["status"],
        database=db_health_info["database"],
        details=db_health_info["details"],
    )

    return HealthResponse(
        status="ok",
        message="AI Rehabilitation Coach backend is running",
        environment=settings.ENVIRONMENT,
        version=settings.VERSION,
        database=db_health,
    )


@router.get(
    "/health/db",
    response_model=DatabaseHealth,
    summary="Database Connection Health Check",
    description="Returns dedicated MongoDB connection status and cluster ping details.",
)
async def get_db_health_status() -> DatabaseHealth:
    """Return live database health check."""
    db_health_info = await db_manager.check_health()
    return DatabaseHealth(
        status=db_health_info["status"],
        database=db_health_info["database"],
        details=db_health_info["details"],
    )
