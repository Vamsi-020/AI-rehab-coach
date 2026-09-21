"""Rehabilitation session API endpoints.

Routes:
    POST /sessions      — Log a new session (authenticated patients only).
    GET  /sessions/me   — List the current patient's sessions.
"""

from typing import List

from fastapi import APIRouter, Depends, status

from backend.app.core.dependencies import get_current_active_user
from backend.app.schemas.session import SessionCreateRequest, SessionResponse
from backend.app.services.session_service import create_session, list_sessions

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.post(
    "",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log a completed rehabilitation session",
)
async def log_session(
    payload: SessionCreateRequest,
    current_user: dict = Depends(get_current_active_user),
) -> SessionResponse:
    """Record a completed exercise session for the authenticated patient.

    - Requires a valid Bearer token.
    - Stores AI form accuracy, peak angle, sets/reps, and optional notes.
    - Returns the full persisted session record.
    """
    patient_id = str(current_user["_id"])
    return await create_session(patient_id=patient_id, payload=payload)


@router.get(
    "/me",
    response_model=List[SessionResponse],
    summary="List the current patient's recent sessions",
)
async def get_my_sessions(
    current_user: dict = Depends(get_current_active_user),
) -> List[SessionResponse]:
    """Return the authenticated patient's session history (most recent first).

    - Requires a valid Bearer token.
    - Returns up to 20 sessions by default.
    """
    patient_id = str(current_user["_id"])
    return await list_sessions(patient_id=patient_id)
