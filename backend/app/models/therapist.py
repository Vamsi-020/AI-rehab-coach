"""Physiotherapist domain model."""

from typing import List, Optional
from pydantic import Field
from backend.app.models.base import MongoBaseModel, PyObjectId


class TherapistModel(MongoBaseModel):
    """Therapists collection model for licensed physical therapists and clinicians."""

    user_id: PyObjectId = Field(..., description="Foreign key reference to User ID")
    license_number: str = Field(..., description="State or board clinical license ID")
    specialty: str = Field(
        default="Orthopedic & Sports Physical Therapy",
        description="Clinical specialty or focus area",
    )
    clinic_organization: str = Field(
        ..., description="Affiliated clinic, hospital, or practice name"
    )
    contact_phone: Optional[str] = Field(default=None, description="Clinic phone number")
    is_accepting_patients: bool = Field(
        default=True, description="Availability flag for new patient intake"
    )
