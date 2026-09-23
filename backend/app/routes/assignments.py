"""Exercise prescription and assignment routes (Phases 16–17).

Provides:
- POST /api/v1/assignments (create a new exercise prescription)
- GET /api/v1/assignments/my-routine (patient: get own active prescriptions)
- GET /api/v1/assignments/patient/{patient_id} (list assignments for a patient)
- GET /api/v1/assignments/{assignment_id} (retrieve a specific assignment)
- PUT /api/v1/assignments/{assignment_id} (update an assignment)
- DELETE /api/v1/assignments/{assignment_id} (deactivate/complete an assignment)
"""

from typing import List
from fastapi import APIRouter, Depends, status

from backend.app.core.dependencies import get_current_active_user, require_clinician_user
from backend.app.schemas.assignment import (
    AssignmentCreateRequest,
    AssignmentListResponse,
    AssignmentResponse,
    AssignmentUpdateRequest,
)
from backend.app.services import assignment_service

router = APIRouter(prefix="/assignments", tags=["Exercise Prescriptions"])


# ---------------------------------------------------------------------------
# Phase 17 — Patient self-service: my active routine
# Must be declared BEFORE /{assignment_id} to avoid path parameter capture.
# ---------------------------------------------------------------------------

@router.get(
    "/my-routine",
    response_model=AssignmentListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get My Active Routine",
    description=(
        "Return all active exercise prescriptions assigned to the currently authenticated patient. "
        "Data is scoped strictly to the JWT-authenticated user — no patient_id is accepted from the client."
    ),
)
async def get_my_routine_endpoint(
    current_user: dict = Depends(get_current_active_user),
) -> AssignmentListResponse:
    """Return active prescriptions for the authenticated patient."""
    patient_user_id = str(current_user["_id"])
    assignments: List[AssignmentResponse] = await assignment_service.get_my_active_routine(
        patient_user_id
    )
    return AssignmentListResponse(assignments=assignments, total=len(assignments))


# ---------------------------------------------------------------------------
# Phase 16 — Clinician prescription management
# ---------------------------------------------------------------------------

@router.post(
    "",
    response_model=AssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Prescribe Exercise Routine",
    description="Create a new exercise assignment for an assigned patient. Requires clinician role.",
)
async def create_prescription_endpoint(
    payload: AssignmentCreateRequest,
    current_user: dict = Depends(require_clinician_user),
) -> AssignmentResponse:
    """Create a new exercise prescription for the target patient."""
    therapist_user_id = str(current_user["_id"])
    return await assignment_service.create_prescription(therapist_user_id, payload)


@router.get(
    "/patient/{patient_id}",
    response_model=AssignmentListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Patient Prescriptions",
    description="Retrieve all exercise prescriptions assigned to a specific patient. Requires clinician role.",
)
async def get_patient_prescriptions_endpoint(
    patient_id: str,
    current_user: dict = Depends(require_clinician_user),
) -> AssignmentListResponse:
    """Return all exercise assignments for given patient."""
    therapist_user_id = str(current_user["_id"])
    assignments: List[AssignmentResponse] = await assignment_service.get_prescriptions_for_patient(
        therapist_user_id, patient_id
    )
    return AssignmentListResponse(assignments=assignments, total=len(assignments))


@router.get(
    "/{assignment_id}",
    response_model=AssignmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Prescription By ID",
    description="Retrieve single exercise prescription details. Requires clinician role.",
)
async def get_prescription_endpoint(
    assignment_id: str,
    current_user: dict = Depends(require_clinician_user),
) -> AssignmentResponse:
    """Return single exercise prescription."""
    therapist_user_id = str(current_user["_id"])
    return await assignment_service.get_prescription_by_id(therapist_user_id, assignment_id)


@router.put(
    "/{assignment_id}",
    response_model=AssignmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Prescription",
    description="Modify prescribed sets, reps, frequency, ROM, or notes. Requires clinician role.",
)
async def update_prescription_endpoint(
    assignment_id: str,
    payload: AssignmentUpdateRequest,
    current_user: dict = Depends(require_clinician_user),
) -> AssignmentResponse:
    """Modify parameters of an existing exercise assignment."""
    therapist_user_id = str(current_user["_id"])
    return await assignment_service.update_prescription(therapist_user_id, assignment_id, payload)


@router.delete(
    "/{assignment_id}",
    response_model=AssignmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Deactivate Prescription",
    description="Deactivate (mark completed) an exercise assignment. Requires clinician role.",
)
async def deactivate_prescription_endpoint(
    assignment_id: str,
    current_user: dict = Depends(require_clinician_user),
) -> AssignmentResponse:
    """Deactivate or complete an exercise assignment."""
    therapist_user_id = str(current_user["_id"])
    return await assignment_service.deactivate_prescription(therapist_user_id, assignment_id)
