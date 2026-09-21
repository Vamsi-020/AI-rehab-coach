"""Exercise catalog domain model."""

from enum import Enum
from typing import List, Optional
from pydantic import Field
from backend.app.models.base import MongoBaseModel


class DifficultyLevel(str, Enum):
    """Exercise difficulty grading."""

    GENTLE = "gentle"
    MODERATE = "moderate"
    ADVANCED = "advanced"


class TargetJoint(str, Enum):
    """Primary anatomical joint evaluated during movement."""

    KNEE = "knee"
    SHOULDER = "shoulder"
    SPINE_LUMBAR = "spine_lumbar"
    HIP = "hip"
    ANKLE = "ankle"
    ELBOW = "elbow"


class ExerciseModel(MongoBaseModel):
    """Exercises collection model representing catalogued physical therapy movements."""

    slug: str = Field(..., description="Unique URL and system slug, e.g., 'seated-knee-extension'")
    name: str = Field(..., description="Display title of the exercise")
    category: str = Field(..., description="Category group, e.g., 'Knee Rehab'")
    description: str = Field(..., description="Detailed clinical description and instructions")
    target_joint: TargetJoint = Field(..., description="Primary anatomical joint tracked")
    difficulty: DifficultyLevel = Field(default=DifficultyLevel.GENTLE, description="Difficulty rating")
    target_angle_min: float = Field(..., description="Minimum target joint angle in degrees")
    target_angle_max: float = Field(..., description="Maximum target joint extension/flexion in degrees")
    target_hold_seconds: float = Field(default=2.0, description="Isometric hold duration in seconds")
    default_sets: int = Field(default=3, description="Standard recommended set count")
    default_reps: int = Field(default=10, description="Standard recommended repetitions per set")
    technique_tips: List[str] = Field(default_factory=list, description="Guidance points and safety rules")
    is_active: bool = Field(default=True, description="Active status in library")
