"""Pydantic response schemas for progress/analytics endpoints."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from backend.app.schemas.session import SessionResponse


class ProgressSummaryResponse(BaseModel):
    """Aggregated recovery metrics for a patient."""

    patient_id: str
    session_count: int = Field(..., description="Total sessions logged")
    avg_form_accuracy_pct: float = Field(..., description="Mean form accuracy across all sessions")
    peak_angle_degrees: Optional[float] = Field(
        default=None, description="All-time best joint angle recorded"
    )
    total_reps_completed: int = Field(..., description="Cumulative reps across all sessions")
    weekly_adherence_pct: float = Field(
        ..., description="Sessions this week vs target (7 sessions/week = 100%)"
    )
    active_streak_days: int = Field(..., description="Current consecutive-day activity streak")
    overall_recovery_score: float = Field(
        ..., description="Composite 0-100 recovery score derived from accuracy and adherence"
    )
    recent_sessions: List[SessionResponse] = Field(
        default_factory=list, description="Last 5 sessions for the history table"
    )


# ---------------------------------------------------------------------------
# Phase 15 — Extended Analytics Schemas
# ---------------------------------------------------------------------------


class AnalyticsTrendPoint(BaseModel):
    """A single data point on a time-series chart."""

    date: str = Field(..., description="ISO date string YYYY-MM-DD")
    value: float = Field(..., description="Metric value for this date")
    label: Optional[str] = Field(default=None, description="Human-readable label")


class ExerciseAnalyticsSummary(BaseModel):
    """Aggregated performance metrics for one exercise type."""

    exercise_name: str
    session_count: int = Field(..., description="Sessions performed for this exercise")
    total_reps: int = Field(..., description="Total repetitions for this exercise")
    avg_form_accuracy_pct: float = Field(..., description="Average form accuracy across sessions")
    best_form_accuracy_pct: float = Field(..., description="Best single-session form accuracy")
    peak_angle_degrees: Optional[float] = Field(
        default=None, description="Best peak angle achieved"
    )
    last_performed: Optional[str] = Field(
        default=None, description="ISO datetime of most recent session"
    )


class SessionHistoryItem(BaseModel):
    """One row in the full session history list."""

    id: str
    exercise_name: str
    sets_completed: int
    reps_completed: int
    average_form_accuracy_pct: float
    peak_angle_degrees: Optional[float] = None
    notes: Optional[str] = None
    created_at: str = Field(..., description="ISO datetime string")
    performance_label: str = Field(
        ..., description="Descriptive label derived from form accuracy"
    )


class SessionHistoryResponse(BaseModel):
    """Paginated session history for the authenticated patient."""

    sessions: List[SessionHistoryItem]
    total: int = Field(..., description="Total sessions in history")
    page: int = Field(..., description="Current page number (1-indexed)")
    page_size: int = Field(..., description="Items per page")
    exercise_filter: Optional[str] = Field(
        default=None, description="Applied exercise name filter"
    )


class DetailedProgressResponse(BaseModel):
    """Full analytics summary used by the Phase 15 Progress Page."""

    patient_id: str
    # Core counts
    session_count: int
    total_reps_completed: int
    # Accuracy metrics
    avg_form_accuracy_pct: float
    peak_angle_degrees: Optional[float] = None
    # Adherence and streak
    weekly_adherence_pct: float
    active_streak_days: int
    # Composite score — application-defined, not a clinical score
    overall_score: float = Field(
        ...,
        description="Application-defined composite score (0-100). Not a medical or clinical score.",
    )
    # Trend data for charts (last 30 sessions max)
    quality_trend: List[AnalyticsTrendPoint] = Field(
        default_factory=list,
        description="Form accuracy over time for chart rendering",
    )
    reps_trend: List[AnalyticsTrendPoint] = Field(
        default_factory=list,
        description="Reps per session over time for chart rendering",
    )
    # Per-exercise breakdown
    exercise_breakdown: List[ExerciseAnalyticsSummary] = Field(
        default_factory=list,
        description="Performance summary grouped by exercise",
    )
    # Recent 5 sessions
    recent_sessions: List[SessionHistoryItem] = Field(
        default_factory=list,
        description="Last 5 sessions for the quick-view table",
    )
    disclaimer: str = Field(
        default=(
            "Application-defined performance metrics. "
            "Not a medical diagnosis or clinical recovery score."
        ),
    )
