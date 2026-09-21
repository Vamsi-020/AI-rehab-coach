"""Rehabilitation workout session domain model."""

from datetime import datetime
from typing import List, Optional
from pydantic import Field
from backend.app.models.base import MongoBaseModel, PyObjectId


class RehabilitationSessionModel(MongoBaseModel):
    """Rehabilitation sessions collection model recording workout metrics and AI posture data."""

    patient_id: PyObjectId = Field(..., description="Patient ID who performed the workout")
    exercise_id: PyObjectId = Field(..., description="Exercise ID performed")
    assignment_id: Optional[PyObjectId] = Field(
        default=None, description="Linked Exercise Assignment ID"
    )
    started_at: datetime = Field(default_factory=datetime.utcnow, description="Session start timestamp")
    completed_at: Optional[datetime] = Field(default=None, description="Session finish timestamp")
    duration_seconds: int = Field(default=0, description="Total active duration in seconds")
    sets_completed: int = Field(default=0, description="Number of sets completed")
    reps_completed: int = Field(default=0, description="Total accurate repetitions logged")
    average_form_accuracy_pct: float = Field(
        default=0.0, description="Average AI kinematic form score (0.0 to 100.0)"
    )
    max_angle_achieved: float = Field(default=0.0, description="Maximum joint angle in degrees")
    min_angle_achieved: float = Field(default=0.0, description="Minimum joint angle in degrees")
    compensation_flags: List[str] = Field(
        default_factory=list,
        description="Kinematic posture warnings detected, e.g., 'trunk_sway', 'hip_drop'",
    )
    is_completed: bool = Field(default=True, description="Whether session was finished successfully")
