"""Pydantic schemas for clinician portal, patient roster, and dashboard endpoints (Phase 16)."""

from typing import List, Optional
from pydantic import BaseModel, Field


class PatientRosterItem(BaseModel):
    """Structured representation of an assigned patient in clinician's roster."""

    id: str = Field(..., description="Unique identifier (patient record or user ID)")
    patient_id: str
    user_id: str
    name: str
    email: Optional[str] = None
    condition: str
    stage: str
    affected_side: str
    compliance: str = Field(default="0%", description="Formatted compliance string e.g. '88%'")
    compliance_rate: float = Field(default=0.0, description="Numerical compliance percentage")
    accuracy: str = Field(default="--", description="Formatted AI form score e.g. '91%'")
    accuracy_score: float = Field(default=0.0, description="Numerical average form score")
    status: str = Field(default="On Track", description="Clinical summary status")
    statusType: str = Field(default="success", description="Status badge styling ('success', 'warning', 'info')")
    recent_sessions_count: int = Field(default=0, description="Number of sessions recorded in last 30 days")
    active_assignments_count: int = Field(default=0, description="Count of active exercise prescriptions")


class ClinicianDashboardMetrics(BaseModel):
    """Aggregate high-level indicators displayed on Clinician Dashboard."""

    active_patients_count: int = Field(default=0, description="Total active assigned patients")
    average_compliance_rate: float = Field(default=0.0, description="Overall compliance average across roster")
    kinematic_form_alerts_count: int = Field(default=0, description="Number of patients with recent kinematic form alerts")
    weekly_review_hours: float = Field(default=0.0, description="Estimated weekly review & tracking hours saved")


class ClinicianDashboardResponse(BaseModel):
    """Complete response payload for Clinician Dashboard."""

    metrics: ClinicianDashboardMetrics
    patients: List[PatientRosterItem]
    total_patients: int


class PatientRosterResponse(BaseModel):
    """Response containing clinician's assigned patient roster."""

    patients: List[PatientRosterItem]
    total: int
