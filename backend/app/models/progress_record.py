"""Progress and recovery analytics domain model."""

from datetime import date
from typing import List, Optional
from pydantic import Field
from backend.app.models.base import MongoBaseModel, PyObjectId


class ProgressRecordModel(MongoBaseModel):
    """Progress records collection model tracking longitudinal recovery metrics."""

    patient_id: PyObjectId = Field(..., description="Target Patient ID")
    record_date: date = Field(default_factory=date.today, description="Date of progress measurement")
    overall_recovery_score: float = Field(
        default=0.0, description="Composite recovery score (0.0 to 100.0)"
    )
    weekly_adherence_pct: float = Field(
        default=0.0, description="Workout completion adherence rate percentage"
    )
    max_rom_degrees: float = Field(
        default=0.0, description="Peak active range of motion achieved"
    )
    pain_score: float = Field(
        default=0.0, description="Patient reported pain index (0.0 to 10.0)"
    )
    active_streak_days: int = Field(
        default=0, description="Current consecutive exercise day streak"
    )
    milestones_unlocked: List[str] = Field(
        default_factory=list,
        description="Earned rehabilitation milestones, e.g., '120_deg_flexion_reached'",
    )
    clinical_notes: Optional[str] = Field(
        default=None, description="Clinician evaluation summary for this period"
    )
