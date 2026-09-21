"""Exercise catalog API endpoints.

Routes:
    GET /exercises       — List all active exercises (optionally filtered by category).
    GET /exercises/{slug} — Single exercise detail by URL slug.
"""

from typing import Optional

from fastapi import APIRouter, Query

from backend.app.schemas.exercise import ExerciseListResponse, ExerciseResponse
from backend.app.services.exercise_service import get_exercise_by_slug, list_exercises

router = APIRouter(prefix="/exercises", tags=["Exercises"])


@router.get(
    "",
    response_model=ExerciseListResponse,
    summary="List all active exercises",
)
async def get_exercises(
    category: Optional[str] = Query(
        default=None,
        description="Filter by category key (e.g. 'knee', 'shoulder', 'spine')",
    )
) -> ExerciseListResponse:
    """Return the full exercise catalog, optionally filtered by category.

    - No authentication required — the library is publicly browsable.
    - Results are sorted alphabetically by name.
    """
    exercises = await list_exercises(category=category)
    return ExerciseListResponse(
        exercises=exercises,
        total=len(exercises),
        category=category,
    )


@router.get(
    "/{slug}",
    response_model=ExerciseResponse,
    summary="Get a single exercise by slug",
)
async def get_exercise(slug: str) -> ExerciseResponse:
    """Return detailed information for a single exercise.

    - **slug**: URL-safe identifier, e.g. ``seated-knee-extension``.
    - Returns HTTP 404 if the slug does not match an active exercise.
    """
    return await get_exercise_by_slug(slug)
