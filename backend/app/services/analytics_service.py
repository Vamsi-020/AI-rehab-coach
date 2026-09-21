"""Phase 15 — Patient Analytics Service.

Provides detailed session history, exercise-specific performance breakdowns,
and trend data for the patient-facing Progress Page.

All queries are scoped to the authenticated patient's own data via patient_id
derived from the JWT token — no arbitrary patient ID is accepted from the
frontend.

Disclaimers:
- Metrics are application-defined performance indicators.
- They do NOT constitute medical diagnoses or clinical recovery scores.
"""

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import HTTPException, status

from backend.app.database.collections import Collections
from backend.app.database.connection import db_manager
from backend.app.schemas.progress import (
    AnalyticsTrendPoint,
    DetailedProgressResponse,
    ExerciseAnalyticsSummary,
    SessionHistoryItem,
    SessionHistoryResponse,
)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _require_sessions_collection():
    """Return the rehabilitation_sessions collection or raise HTTP 503."""
    col = db_manager.get_collection(Collections.REHABILITATION_SESSIONS)
    if col is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is currently unavailable. Please try again later.",
        )
    return col


def _performance_label(accuracy: float) -> str:
    """Return a plain-language performance label from a form-accuracy percentage.

    Labels are descriptive only and carry no medical or clinical meaning.
    """
    if accuracy >= 95:
        return "Excellent"
    if accuracy >= 85:
        return "Good"
    if accuracy >= 70:
        return "Fair"
    return "Needs Improvement"


def _doc_to_history_item(doc: dict) -> SessionHistoryItem:
    """Convert a raw MongoDB session document to a SessionHistoryItem."""
    accuracy = doc.get("average_form_accuracy_pct", 0.0)
    created_at = doc.get("created_at", datetime.utcnow())
    return SessionHistoryItem(
        id=str(doc["_id"]),
        exercise_name=doc.get("exercise_name", ""),
        sets_completed=doc.get("sets_completed", 0),
        reps_completed=doc.get("reps_completed", 0),
        average_form_accuracy_pct=round(accuracy, 1),
        peak_angle_degrees=doc.get("peak_angle_degrees"),
        notes=doc.get("notes"),
        created_at=created_at.isoformat() if isinstance(created_at, datetime) else str(created_at),
        performance_label=_performance_label(accuracy),
    )


def _compute_streak(docs: list) -> int:
    """Count consecutive calendar days (UTC) that have at least one session."""
    if not docs:
        return 0
    session_dates = sorted(
        {d["created_at"].date() for d in docs if isinstance(d.get("created_at"), datetime)},
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
            break
    return streak


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------

async def get_session_history(
    patient_id: str,
    page: int = 1,
    page_size: int = 20,
    exercise_filter: Optional[str] = None,
) -> SessionHistoryResponse:
    """Return paginated session history for the authenticated patient.

    Args:
        patient_id: Patient's user ID string (from JWT — not from request params).
        page: 1-indexed page number.
        page_size: Maximum items per page (capped at 50).
        exercise_filter: Optional case-insensitive substring filter on exercise_name.

    Returns:
        SessionHistoryResponse with sessions, total count, and pagination metadata.
    """
    collection = _require_sessions_collection()

    page = max(1, page)
    page_size = max(1, min(50, page_size))
    skip = (page - 1) * page_size

    query: dict = {"patient_id": patient_id}
    if exercise_filter:
        import re
        query["exercise_name"] = {"$regex": re.escape(exercise_filter.strip()), "$options": "i"}

    total = await collection.count_documents(query)

    cursor = collection.find(query).sort("created_at", -1).skip(skip).limit(page_size)
    docs = await cursor.to_list(length=page_size)

    sessions = [_doc_to_history_item(doc) for doc in docs]

    return SessionHistoryResponse(
        sessions=sessions,
        total=total,
        page=page,
        page_size=page_size,
        exercise_filter=exercise_filter,
    )


async def get_exercise_progress(
    patient_id: str,
    exercise_name: Optional[str] = None,
) -> List[ExerciseAnalyticsSummary]:
    """Return per-exercise performance breakdowns for the authenticated patient.

    If exercise_name is provided, returns a single-item list for that exercise.
    Otherwise returns all exercises performed.

    Args:
        patient_id: Patient's user ID string.
        exercise_name: Optional filter to a single exercise name.

    Returns:
        List of ExerciseAnalyticsSummary, one per distinct exercise.
    """
    collection = _require_sessions_collection()

    query: dict = {"patient_id": patient_id}
    if exercise_name:
        import re
        query["exercise_name"] = {"$regex": re.escape(exercise_name.strip()), "$options": "i"}

    cursor = collection.find(query).sort("created_at", -1)
    all_docs = await cursor.to_list(length=1000)

    if not all_docs:
        return []

    # Group by exercise_name
    grouped: dict = {}
    for doc in all_docs:
        name = doc.get("exercise_name", "Unknown")
        if name not in grouped:
            grouped[name] = []
        grouped[name].append(doc)

    summaries = []
    for name, docs in grouped.items():
        accuracies = [d.get("average_form_accuracy_pct", 0.0) for d in docs]
        angles = [d["peak_angle_degrees"] for d in docs if d.get("peak_angle_degrees") is not None]
        total_reps = sum(d.get("reps_completed", 0) for d in docs)

        # Most-recent session timestamp
        dates = [d["created_at"] for d in docs if isinstance(d.get("created_at"), datetime)]
        last_performed = max(dates).isoformat() if dates else None

        summaries.append(
            ExerciseAnalyticsSummary(
                exercise_name=name,
                session_count=len(docs),
                total_reps=total_reps,
                avg_form_accuracy_pct=round(sum(accuracies) / len(accuracies), 1),
                best_form_accuracy_pct=round(max(accuracies), 1),
                peak_angle_degrees=round(max(angles), 1) if angles else None,
                last_performed=last_performed,
            )
        )

    # Sort by session count descending
    summaries.sort(key=lambda s: s.session_count, reverse=True)
    return summaries


async def get_detailed_analytics(patient_id: str) -> DetailedProgressResponse:
    """Compute the full analytics summary for the authenticated patient.

    Aggregates all sessions to produce:
    - Core counts (sessions, reps)
    - Accuracy and adherence metrics
    - Activity streak
    - Trend series for charts (up to 30 data points)
    - Exercise-specific breakdown
    - Recent 5 sessions

    All derived metrics are application-defined performance indicators.
    They do NOT constitute medical diagnoses or clinical recovery scores.

    Args:
        patient_id: Patient's user ID string (from JWT).

    Returns:
        DetailedProgressResponse — safe to pass directly to the frontend.
    """
    collection = _require_sessions_collection()

    # Fetch all sessions, newest first
    cursor = collection.find({"patient_id": patient_id}).sort("created_at", -1)
    all_docs = await cursor.to_list(length=1000)

    session_count = len(all_docs)

    # ── Zero-state for new patients ──────────────────────────────────────────
    if session_count == 0:
        return DetailedProgressResponse(
            patient_id=patient_id,
            session_count=0,
            total_reps_completed=0,
            avg_form_accuracy_pct=0.0,
            peak_angle_degrees=None,
            weekly_adherence_pct=0.0,
            active_streak_days=0,
            overall_score=0.0,
            quality_trend=[],
            reps_trend=[],
            exercise_breakdown=[],
            recent_sessions=[],
        )

    # ── Core aggregations ────────────────────────────────────────────────────
    accuracies = [d.get("average_form_accuracy_pct", 0.0) for d in all_docs]
    avg_accuracy = round(sum(accuracies) / len(accuracies), 1)

    angles = [d["peak_angle_degrees"] for d in all_docs if d.get("peak_angle_degrees") is not None]
    peak_angle = round(max(angles), 1) if angles else None

    total_reps = sum(d.get("reps_completed", 0) for d in all_docs)

    # ── Weekly adherence ─────────────────────────────────────────────────────
    week_ago = datetime.utcnow() - timedelta(days=7)
    sessions_this_week = sum(
        1 for d in all_docs
        if isinstance(d.get("created_at"), datetime) and d["created_at"] >= week_ago
    )
    weekly_adherence = min(round((sessions_this_week / 7) * 100, 1), 100.0)

    # ── Streak ───────────────────────────────────────────────────────────────
    streak = _compute_streak(all_docs)

    # ── Composite score (60% accuracy + 40% adherence) ──────────────────────
    overall_score = round(0.6 * avg_accuracy + 0.4 * weekly_adherence, 1)
    overall_score = max(0.0, min(100.0, overall_score))

    # ── Trend series (last 30 sessions, chronological order) ────────────────
    trend_docs = list(reversed(all_docs[:30]))  # oldest first for chart X-axis

    quality_trend: List[AnalyticsTrendPoint] = []
    reps_trend: List[AnalyticsTrendPoint] = []

    for i, doc in enumerate(trend_docs):
        created = doc.get("created_at")
        date_str = created.strftime("%Y-%m-%d") if isinstance(created, datetime) else f"Session {i + 1}"
        label = f"Session {i + 1}"

        quality_trend.append(
            AnalyticsTrendPoint(
                date=date_str,
                value=round(doc.get("average_form_accuracy_pct", 0.0), 1),
                label=label,
            )
        )
        reps_trend.append(
            AnalyticsTrendPoint(
                date=date_str,
                value=float(doc.get("reps_completed", 0)),
                label=label,
            )
        )

    # ── Exercise breakdown ───────────────────────────────────────────────────
    exercise_breakdown = await get_exercise_progress(patient_id)

    # ── Recent 5 sessions ────────────────────────────────────────────────────
    recent_sessions = [_doc_to_history_item(doc) for doc in all_docs[:5]]

    return DetailedProgressResponse(
        patient_id=patient_id,
        session_count=session_count,
        total_reps_completed=total_reps,
        avg_form_accuracy_pct=avg_accuracy,
        peak_angle_degrees=peak_angle,
        weekly_adherence_pct=weekly_adherence,
        active_streak_days=streak,
        overall_score=overall_score,
        quality_trend=quality_trend,
        reps_trend=reps_trend,
        exercise_breakdown=exercise_breakdown,
        recent_sessions=recent_sessions,
    )
