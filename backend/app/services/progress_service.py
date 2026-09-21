"""Progress / analytics service layer.

Aggregates rehabilitation sessions to compute recovery metrics for a patient.
"""

from datetime import datetime, timedelta
from typing import List

from fastapi import HTTPException, status

from backend.app.database.collections import Collections
from backend.app.database.connection import db_manager
from backend.app.schemas.progress import ProgressSummaryResponse
from backend.app.schemas.session import SessionResponse
from backend.app.services.session_service import _session_doc_to_response


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_collection():
    """Return sessions collection or raise HTTP 503."""
    col = db_manager.get_collection(Collections.REHABILITATION_SESSIONS)
    if col is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is currently unavailable. Please try again later.",
        )
    return col


# ---------------------------------------------------------------------------
# Service functions
# ---------------------------------------------------------------------------

async def get_progress_summary(patient_id: str) -> ProgressSummaryResponse:
    """Aggregate session data into a recovery dashboard summary.

    Computes:
    - ``session_count``           — total sessions ever logged
    - ``avg_form_accuracy_pct``   — mean AI accuracy across all sessions
    - ``peak_angle_degrees``      — all-time best joint angle
    - ``total_reps_completed``    — cumulative rep count
    - ``weekly_adherence_pct``    — sessions in the last 7 days / 7 × 100
    - ``active_streak_days``      — current consecutive-day streak
    - ``overall_recovery_score``  — weighted composite of accuracy + adherence
    - ``recent_sessions``         — last 5 sessions for the history table
    """
    collection = _require_collection()

    # Fetch all sessions for this patient (sorted newest-first)
    cursor = collection.find({"patient_id": patient_id}).sort("created_at", -1)
    all_docs = await cursor.to_list(length=1000)

    session_count = len(all_docs)

    if session_count == 0:
        # Return a zero-state summary for new patients
        return ProgressSummaryResponse(
            patient_id=patient_id,
            session_count=0,
            avg_form_accuracy_pct=0.0,
            peak_angle_degrees=None,
            total_reps_completed=0,
            weekly_adherence_pct=0.0,
            active_streak_days=0,
            overall_recovery_score=0.0,
            recent_sessions=[],
        )

    # Core aggregations
    accuracy_values = [d["average_form_accuracy_pct"] for d in all_docs]
    avg_accuracy = sum(accuracy_values) / len(accuracy_values)

    angles = [d["peak_angle_degrees"] for d in all_docs if d.get("peak_angle_degrees") is not None]
    peak_angle = max(angles) if angles else None

    total_reps = sum(d["reps_completed"] for d in all_docs)

    # Weekly adherence — count sessions in the last 7 days
    week_ago = datetime.utcnow() - timedelta(days=7)
    sessions_this_week = sum(1 for d in all_docs if d["created_at"] >= week_ago)
    # Target: 1 session per day = 7 per week → 100%
    weekly_adherence = min(round((sessions_this_week / 7) * 100, 1), 100.0)

    # Active streak — walk backwards through days
    streak = _compute_streak(all_docs)

    # Composite recovery score: 60% accuracy + 40% adherence
    overall_score = round(0.6 * avg_accuracy + 0.4 * weekly_adherence, 1)

    # Last 5 sessions for the history table
    recent_sessions: List[SessionResponse] = [
        _session_doc_to_response(d) for d in all_docs[:5]
    ]

    return ProgressSummaryResponse(
        patient_id=patient_id,
        session_count=session_count,
        avg_form_accuracy_pct=round(avg_accuracy, 1),
        peak_angle_degrees=peak_angle,
        total_reps_completed=total_reps,
        weekly_adherence_pct=weekly_adherence,
        active_streak_days=streak,
        overall_recovery_score=overall_score,
        recent_sessions=recent_sessions,
    )


def _compute_streak(docs: list) -> int:
    """Count consecutive days with at least one session, going back from today."""
    if not docs:
        return 0

    # Collect unique calendar dates (UTC) that have a session
    session_dates = sorted(
        {d["created_at"].date() for d in docs},
        reverse=True,
    )

    today = datetime.utcnow().date()
    streak = 0
    expected = today

    for date in session_dates:
        if date == expected:
            streak += 1
            expected = expected - timedelta(days=1)
        elif date < expected:
            break  # Gap found — streak ends

    return streak
