"""Main application entrypoint for AI Rehabilitation Coach backend."""

import sys
import os

# Ensure the project root is on sys.path so 'backend.*' imports resolve
# whether uvicorn is launched from the project root OR the backend/ folder.
_here = os.path.dirname(os.path.abspath(__file__))           # …/backend
_root = os.path.dirname(_here)                               # …/AI-Rehabilitation-Coach
if _root not in sys.path:
    sys.path.insert(0, _root)

import uvicorn
from backend.app.core.config import settings
from backend.app.factory import create_application

app = create_application()


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )