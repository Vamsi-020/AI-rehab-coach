"""Physiotherapist / Clinician portal routes (Phase 16).

Provides:
- GET /api/v1/therapist/dashboard (high-level clinical indicators & patient roster)
- GET /api/v1/therapist/patients (assigned patient roster)
"""

from typing import List
from fastapi import APIRouter, Depends, status

from backend.app.core.dependencies import require_clinician_user
from backend.app.schemas.therapist import (
    ClinicianDashboardResponse,
    PatientRosterItem,
    PatientRosterResponse,
)
from backend.app.services import assignment_service

router = APIRouter(prefix="/therapist", tags=["Therapist Clinician Portal"])


@router.get(
    "/dashboard",
    response_model=ClinicianDashboardResponse,
    status_code=status.HTTP_200_OK,
    summary="Clinician Dashboard Summary",
    description="Retrieve aggregate clinical KPIs and assigned patient roster. Requires clinician role.",
)
async def get_dashboard(
    current_user: dict = Depends(require_clinician_user),
) -> ClinicianDashboardResponse:
    """Return dashboard summary metrics and roster for authenticated clinician."""
    therapist_user_id = str(current_user["_id"])
    return await assignment_service.get_clinician_dashboard(therapist_user_id)


@router.get(
    "/patients",
    response_model=PatientRosterResponse,
    status_code=status.HTTP_200_OK,
    summary="Assigned Patient Roster",
    description="Retrieve list of all active patients assigned to the authenticated clinician.",
)
async def get_patients(
    current_user: dict = Depends(require_clinician_user),
) -> PatientRosterResponse:
    """Return assigned patient roster for authenticated clinician."""
    therapist_user_id = str(current_user["_id"])
    roster: List[PatientRosterItem] = await assignment_service.get_clinician_patient_roster(therapist_user_id)
    return PatientRosterResponse(patients=roster, total=len(roster))
