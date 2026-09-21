"""Health check request and response schemas."""

from typing import Optional
from pydantic import BaseModel, Field


class DatabaseHealth(BaseModel):
    """Database connectivity status schema."""

    status: str = Field(..., description="Database status: 'connected' or 'disconnected'")
    database: str = Field(..., description="Configured database name")
    details: str = Field(..., description="Connection status details or ping result")


class HealthResponse(BaseModel):
    """Health check endpoint response model."""

    status: str = Field(default="ok", description="Service status indicator")
    message: str = Field(default="AI Rehabilitation Coach backend is running", description="Status message")
    environment: Optional[str] = Field(default=None, description="Current deployment environment")
    version: Optional[str] = Field(default=None, description="API version")
    database: Optional[DatabaseHealth] = Field(default=None, description="Database connection health")
