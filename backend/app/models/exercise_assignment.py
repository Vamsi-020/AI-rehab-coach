"""Exercise prescription and assignment domain model."""

from datetime import date
from enum import Enum
from typing import Optional
from pydantic import Field
from backend.app.models.base import MongoBaseModel, PyObjectId


class AssignmentStatus(str, Enum):
    """Status of an assigned exercise prescription."""

    ACTIVE = "active"
    COMPLETED = "completed"
    PAUSED = "paused"


class ExerciseAssignmentModel(MongoBaseModel):
    """Exercise assignments collection model for customized routines assigned by therapists."""

    patient_id: PyObjectId = Field(..., description="Target Patient ID")
    therapist_id: PyObjectId = Field(..., description="Prescribing Therapist ID")
    exercise_id: PyObjectId = Field(..., description="Catalog Exercise ID")
    prescribed_sets: int = Field(default=3, description="Assigned sets per workout")
    prescribed_reps: int = Field(default=10, description="Assigned reps per set")
    frequency_per_week: int = Field(default=5, description="Recommended workout days per week")
    target_rom_degrees: Optional[float] = Field(default=None, description="Custom target ROM angle")
    custom_instructions: Optional[str] = Field(
        default=None, description="Specific therapist notes for this patient"
    )
    start_date: date = Field(default_factory=date.today, description="Prescription start date")
    end_date: Optional[date] = Field(default=None, description="Prescription completion date")
    status: AssignmentStatus = Field(
        default=AssignmentStatus.ACTIVE, description="Current assignment lifecycle status"
    )
