"""Patient profile domain model."""

from datetime import date
from enum import Enum
from typing import List, Optional
from pydantic import Field
from backend.app.models.base import MongoBaseModel, PyObjectId


class AffectedSide(str, Enum):
    """Anatomical side affected by injury or surgery."""

    LEFT = "left"
    RIGHT = "right"
    BILATERAL = "bilateral"
    CENTRAL = "central"


class PatientModel(MongoBaseModel):
    """Patients collection model for rehabilitation patient profiles."""

    user_id: PyObjectId = Field(..., description="Foreign key reference to User ID")
    assigned_therapist_id: Optional[PyObjectId] = Field(
        default=None, description="Foreign key reference to Therapist ID"
    )
    injury_condition: str = Field(
        ..., description="Injury or clinical diagnosis, e.g., 'ACL Reconstruction'"
    )
    affected_side: AffectedSide = Field(
        default=AffectedSide.RIGHT, description="Affected anatomical side"
    )
    protocol_stage: str = Field(
        default="Week 1 Protocol", description="Current phase in rehabilitation plan"
    )
    surgery_date: Optional[date] = Field(
        default=None, description="Date of surgery if post-operative"
    )
    baseline_rom_degrees: float = Field(
        default=90.0, description="Initial measured range of motion in degrees"
    )
    target_rom_degrees: float = Field(
        default=135.0, description="Target discharge range of motion in degrees"
    )
    medical_notes: Optional[str] = Field(
        default=None, description="Physician and therapist clinical notes"
    )
