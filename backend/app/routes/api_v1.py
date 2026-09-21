"""Centralized API v1 router consolidating all modular endpoint routers."""

from fastapi import APIRouter
from backend.app.routes import health
from backend.app.routes import auth
from backend.app.routes import exercises
from backend.app.routes import sessions
from backend.app.routes import progress

api_v1_router = APIRouter()

# Register modular sub-routers under API v1
api_v1_router.include_router(health.router)
api_v1_router.include_router(auth.router)
api_v1_router.include_router(exercises.router)
api_v1_router.include_router(sessions.router)
api_v1_router.include_router(progress.router)
