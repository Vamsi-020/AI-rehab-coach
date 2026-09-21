"""Pydantic request/response schemas for exercise catalog endpoints."""

from typing import List, Optional

from pydantic import BaseModel, Field

from backend.app.models.exercise import DifficultyLevel, TargetJoint


class ExerciseResponse(BaseModel):
    """Safe public representation of a single exercise."""

    id: str = Field(..., description="MongoDB document ID as string")
    slug: str
    name: str
    category: str
    description: str
    target_joint: TargetJoint
    difficulty: DifficultyLevel
    target_angle_min: float
    target_angle_max: float
    target_hold_seconds: float
    default_sets: int
    default_reps: int
    technique_tips: List[str]
    is_active: bool

    model_config = {"from_attributes": True}


class ExerciseListResponse(BaseModel):
    """Paginated exercise catalog response."""

    exercises: List[ExerciseResponse]
    total: int
    category: Optional[str] = None
