"""API route modules for AI Rehabilitation Coach."""

from backend.app.routes.api_v1 import api_v1_router
from backend.app.routes.health import router as health_router

__all__ = ["api_v1_router", "health_router"]
