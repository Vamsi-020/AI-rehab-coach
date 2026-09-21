"""System and clinical notification domain model."""

from enum import Enum
from typing import Optional
from pydantic import Field
from backend.app.models.base import MongoBaseModel, PyObjectId


class NotificationType(str, Enum):
    """Notification classification category."""

    ROUTINE_REMINDER = "routine_reminder"
    CLINICAL_FEEDBACK = "clinical_feedback"
    MILESTONE_UNLOCKED = "milestone_unlocked"
    KINEMATIC_ALERT = "kinematic_alert"
    SYSTEM = "system"


class NotificationModel(MongoBaseModel):
    """Notifications collection model for patient and clinician alerts."""

    recipient_user_id: PyObjectId = Field(..., description="Target recipient User ID")
    type: NotificationType = Field(
        default=NotificationType.ROUTINE_REMINDER, description="Category of notification"
    )
    title: str = Field(..., description="Notification headline")
    message: str = Field(..., description="Notification body content")
    action_url: Optional[str] = Field(
        default=None, description="Optional deep link or page route for action"
    )
    is_read: bool = Field(default=False, description="Read status flag")
