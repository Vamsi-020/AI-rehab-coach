"""Database models package for AI Rehabilitation Coach."""

from backend.app.models.base import MongoBaseModel, PyObjectId
from backend.app.models.exercise import DifficultyLevel, ExerciseModel, TargetJoint
from backend.app.models.exercise_assignment import AssignmentStatus, ExerciseAssignmentModel
from backend.app.models.notification import NotificationModel, NotificationType
from backend.app.models.patient import AffectedSide, PatientModel
from backend.app.models.progress_record import ProgressRecordModel
from backend.app.models.rehabilitation_session import RehabilitationSessionModel
from backend.app.models.therapist import TherapistModel
from backend.app.models.user import UserModel, UserRole, UserStatus

__all__ = [
    "MongoBaseModel",
    "PyObjectId",
    "UserModel",
    "UserRole",
    "UserStatus",
    "PatientModel",
    "AffectedSide",
    "TherapistModel",
    "ExerciseModel",
    "DifficultyLevel",
    "TargetJoint",
    "ExerciseAssignmentModel",
    "AssignmentStatus",
    "RehabilitationSessionModel",
    "ProgressRecordModel",
    "NotificationModel",
    "NotificationType",
]
