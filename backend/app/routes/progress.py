"""Progress and analytics API endpoints.

Phase 14 (existing):
    GET /progress/me — Aggregated recovery summary (backwards-compatible).

Phase 15 (new):
    GET /progress/analytics      — Detailed analytics with trend data & exercise breakdown.
    GET /progress/history        — Paginated session history with optional exercise filter.
    GET /progress/exercises      — Per-exercise performance breakdown.

All endpoints require a valid Bearer JWT token.
Patient identity is derived from the token — frontend cannot request another patient's data.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from backend.app.core.dependencies import get_current_active_user
from backend.app.schemas.progress import (
    DetailedProgressResponse,
    ExerciseAnalyticsSummary,
    ProgressSummaryResponse,
    SessionHistoryResponse,
)
from backend.app.services.analytics_service import (
    get_detailed_analytics,
    get_exercise_progress,
    get_session_history,
)
from backend.app.services.progress_service import get_progress_summary

router = APIRouter(prefix="/progress", tags=["Progress"])


# ---------------------------------------------------------------------------
# Phase 14 (preserved, backwards-compatible)
# ---------------------------------------------------------------------------

@router.get(
    "/me",
    response_model=ProgressSummaryResponse,
    summary="Get the current patient's recovery progress summary",
)
async def get_my_progress(
    current_user: dict = Depends(get_current_active_user),
) -> ProgressSummaryResponse:
    """Return aggregated recovery metrics for the authenticated patient.

    Computed metrics include:
    - Total sessions logged
    - Average AI form accuracy
    - Peak joint angle (all-time best)
    - Weekly adherence percentage
    - Current consecutive-day activity streak
    - Composite overall recovery score (0–100)
    - Last 5 sessions for the history audit trail

    Requires a valid Bearer token.
    """
    patient_id = str(current_user["_id"])
    return await get_progress_summary(patient_id=patient_id)


# ---------------------------------------------------------------------------
# Phase 15 — New analytics endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/analytics",
    response_model=DetailedProgressResponse,
    summary="Get detailed analytics with trend data and exercise breakdown",
    description=(
        "Returns comprehensive performance analytics including form-accuracy trend, "
        "reps-over-time series, per-exercise breakdowns, and recent sessions. "
        "All metrics are application-defined. Not a medical or clinical score."
    ),
)
async def get_my_analytics(
    current_user: dict = Depends(get_current_active_user),
) -> DetailedProgressResponse:
    """Return full analytics summary for the authenticated patient.

    Includes trend data points for chart rendering and per-exercise summaries.
    Patient identity is derived from the JWT token — no patient_id parameter accepted.
    """
    patient_id = str(current_user["_id"])
    return await get_detailed_analytics(patient_id=patient_id)


@router.get(
    "/history",
    response_model=SessionHistoryResponse,
    summary="Paginated session history with optional exercise filter",
    description=(
        "Returns the patient's session history, newest first. "
        "Optionally filtered by exercise name (case-insensitive substring match). "
        "Paginated to avoid returning very large payloads."
    ),
)
async def get_my_history(
    current_user: dict = Depends(get_current_active_user),
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(default=20, ge=1, le=50, description="Items per page (max 50)"),
    exercise: Optional[str] = Query(
        default=None,
        description="Optional exercise name filter (case-insensitive substring match)",
    ),
) -> SessionHistoryResponse:
    """Return paginated session history for the authenticated patient.

    Patient identity is derived from the JWT token — no patient_id accepted as a query param.
    """
    patient_id = str(current_user["_id"])
    return await get_session_history(
        patient_id=patient_id,
        page=page,
        page_size=page_size,
        exercise_filter=exercise,
    )


@router.get(
    "/exercises",
    response_model=List[ExerciseAnalyticsSummary],
    summary="Per-exercise performance breakdown",
    description=(
        "Returns aggregated performance metrics grouped by exercise type. "
        "Optionally filter to a single exercise name."
    ),
)
async def get_my_exercise_progress(
    current_user: dict = Depends(get_current_active_user),
    exercise: Optional[str] = Query(
        default=None,
        description="Optional exercise name filter (case-insensitive substring match)",
    ),
) -> List[ExerciseAnalyticsSummary]:
    """Return per-exercise analytics for the authenticated patient.

    Patient identity is derived from the JWT token — no patient_id accepted.
    """
    patient_id = str(current_user["_id"])
    return await get_exercise_progress(
        patient_id=patient_id,
        exercise_name=exercise,
    )
