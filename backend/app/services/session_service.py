"""Rehabilitation session service layer.

Handles creating and retrieving session records for patients.
"""

import asyncio
from datetime import datetime
from typing import List

from bson import ObjectId
from fastapi import HTTPException, status

from backend.app.database.collections import Collections
from backend.app.database.connection import db_manager
from backend.app.schemas.session import SessionCreateRequest, SessionResponse
from backend.app.services import notification_service


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _session_doc_to_response(doc: dict) -> SessionResponse:
    """Convert a raw MongoDB session document to :class:`SessionResponse`."""
    return SessionResponse(
        id=str(doc["_id"]),
        patient_id=str(doc["patient_id"]),
        exercise_id=str(doc["exercise_id"]),
        exercise_name=doc.get("exercise_name", ""),
        sets_completed=doc["sets_completed"],
        reps_completed=doc["reps_completed"],
        average_form_accuracy_pct=doc["average_form_accuracy_pct"],
        peak_angle_degrees=doc.get("peak_angle_degrees"),
        notes=doc.get("notes"),
        created_at=doc["created_at"],
    )


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

async def create_session(patient_id: str, payload: SessionCreateRequest) -> SessionResponse:
    """Insert a new rehabilitation session document and return its representation.

    Args:
        patient_id: The authenticated patient's user ID (from JWT).
        payload: Validated ``SessionCreateRequest`` body.
    """
    collection = _require_collection()

    now = datetime.utcnow()
    doc = {
        "_id": ObjectId(),
        "patient_id": patient_id,
        "exercise_id": payload.exercise_id,
        "exercise_name": payload.exercise_name,
        "sets_completed": payload.sets_completed,
        "reps_completed": payload.reps_completed,
        "average_form_accuracy_pct": payload.average_form_accuracy_pct,
        "peak_angle_degrees": payload.peak_angle_degrees,
        "notes": payload.notes,
        "created_at": now,
        "updated_at": now,
    }

    await collection.insert_one(doc)

    # Phase 17: Trigger recovery milestone evaluation in background (non-blocking)
    try:
        asyncio.create_task(
            notification_service.evaluate_recovery_milestones(patient_id, doc)
        )
    except Exception:  # pragma: no cover — background task errors must not fail the session save
        pass

    return _session_doc_to_response(doc)


async def list_sessions(patient_id: str, limit: int = 20) -> List[SessionResponse]:
    """Return the most recent sessions for a given patient.

    Args:
        patient_id: The authenticated patient's user ID.
        limit: Maximum number of sessions to return (default 20).
    """
    collection = _require_collection()

    cursor = (
        collection.find({"patient_id": patient_id})
        .sort("created_at", -1)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    return [_session_doc_to_response(doc) for doc in docs]
