"""Pydantic schemas for exercise assignment and routine prescription endpoints (Phase 16)."""

from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from backend.app.models.exercise_assignment import AssignmentStatus


class AssignmentCreateRequest(BaseModel):
    """Payload to prescribe a new rehabilitation routine to a patient."""

    patient_id: str = Field(..., description="Target patient record ID or user ID")
    exercise_id: str = Field(..., description="Exercise catalog document ID or slug")
    prescribed_sets: int = Field(default=3, ge=1, le=20, description="Assigned sets per workout")
    prescribed_reps: int = Field(default=10, ge=1, le=100, description="Assigned reps per set")
    frequency_per_week: int = Field(default=5, ge=1, le=7, description="Recommended workout days per week")
    target_rom_degrees: Optional[float] = Field(default=None, ge=0.0, le=360.0, description="Prescribed range of motion target in degrees")
    custom_instructions: Optional[str] = Field(default=None, max_length=1000, description="Clinician guidance notes for patient")
    start_date: Optional[date] = Field(default=None, description="Prescription start date")
    end_date: Optional[date] = Field(default=None, description="Prescription target completion date")


class AssignmentUpdateRequest(BaseModel):
    """Payload to modify an existing exercise prescription."""

    prescribed_sets: Optional[int] = Field(default=None, ge=1, le=20)
    prescribed_reps: Optional[int] = Field(default=None, ge=1, le=100)
    frequency_per_week: Optional[int] = Field(default=None, ge=1, le=7)
    target_rom_degrees: Optional[float] = Field(default=None, ge=0.0, le=360.0)
    custom_instructions: Optional[str] = Field(default=None, max_length=1000)
    status: Optional[AssignmentStatus] = Field(default=None, description="Assignment lifecycle status")


class AssignmentResponse(BaseModel):
    """Public representation of an assigned exercise prescription."""

    id: str = Field(..., description="Assignment document ID")
    patient_id: str
    therapist_id: str
    exercise_id: str
    exercise_name: Optional[str] = None
    exercise_slug: Optional[str] = None
    target_joint: Optional[str] = None
    prescribed_sets: int
    prescribed_reps: int
    frequency_per_week: int
    target_rom_degrees: Optional[float] = None
    custom_instructions: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AssignmentListResponse(BaseModel):
    """Response containing a list of exercise assignments."""

    assignments: List[AssignmentResponse]
    total: int
