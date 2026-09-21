"""Exercise catalog service layer.

Provides functions to list and retrieve exercises from MongoDB.
All business logic lives here; routes remain thin.
"""

from typing import List, Optional

from fastapi import HTTPException, status

from backend.app.database.collections import Collections
from backend.app.database.connection import db_manager
from backend.app.schemas.exercise import ExerciseResponse


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _exercise_doc_to_response(doc: dict) -> ExerciseResponse:
    """Convert a raw MongoDB exercise document to :class:`ExerciseResponse`."""
    return ExerciseResponse(
        id=str(doc["_id"]),
        slug=doc["slug"],
        name=doc["name"],
        category=doc["category"],
        description=doc["description"],
        target_joint=doc["target_joint"],
        difficulty=doc["difficulty"],
        target_angle_min=doc["target_angle_min"],
        target_angle_max=doc["target_angle_max"],
        target_hold_seconds=doc.get("target_hold_seconds", 2.0),
        default_sets=doc.get("default_sets", 3),
        default_reps=doc.get("default_reps", 10),
        technique_tips=doc.get("technique_tips", []),
        is_active=doc.get("is_active", True),
    )


def _require_collection():
    """Return exercises collection or raise HTTP 503."""
    col = db_manager.get_collection(Collections.EXERCISES)
    if col is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is currently unavailable. Please try again later.",
        )
    return col


# ---------------------------------------------------------------------------
# Service functions
# ---------------------------------------------------------------------------

async def list_exercises(category: Optional[str] = None) -> List[ExerciseResponse]:
    """Return all active exercises, optionally filtered by category slug.

    Args:
        category: Optional category key to filter by (e.g. ``'knee'``).
                  If ``None``, all active exercises are returned.
    """
    collection = _require_collection()

    query: dict = {"is_active": True}
    if category:
        # Match against category_key field stored on exercise documents
        query["category_key"] = category

    cursor = collection.find(query).sort("name", 1)
    docs = await cursor.to_list(length=100)
    return [_exercise_doc_to_response(doc) for doc in docs]


async def get_exercise_by_slug(slug: str) -> ExerciseResponse:
    """Return a single exercise by its URL slug.

    Raises:
        HTTP 404 — exercise not found or inactive.
    """
    collection = _require_collection()
    doc = await collection.find_one({"slug": slug, "is_active": True})
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exercise '{slug}' not found.",
        )
    return _exercise_doc_to_response(doc)
