"""Pydantic request/response schemas for rehabilitation session endpoints."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SessionCreateRequest(BaseModel):
    """Body schema for POST /api/v1/sessions."""

    exercise_id: str = Field(..., description="MongoDB ObjectId of the exercise performed")
    exercise_name: str = Field(..., description="Human-readable exercise name (denormalised for speed)")
    sets_completed: int = Field(..., ge=0, description="Number of sets completed")
    reps_completed: int = Field(..., ge=0, description="Total repetitions completed")
    average_form_accuracy_pct: float = Field(
        ..., ge=0.0, le=100.0, description="AI-computed form accuracy percentage"
    )
    peak_angle_degrees: Optional[float] = Field(
        default=None, description="Peak joint angle reached during the session (degrees)"
    )
    notes: Optional[str] = Field(
        default=None, max_length=500, description="Optional patient or therapist notes"
    )


class SessionResponse(BaseModel):
    """Full session record returned to the client."""

    id: str
    patient_id: str
    exercise_id: str
    exercise_name: str
    sets_completed: int
    reps_completed: int
    average_form_accuracy_pct: float
    peak_angle_degrees: Optional[float]
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
