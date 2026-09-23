"""Pydantic schemas for patient notification endpoints (Phase 17)."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class NotificationResponse(BaseModel):
    """Public representation of a single patient/clinical notification."""

    id: str = Field(..., description="Notification document ID")
    recipient_user_id: str = Field(..., description="Recipient user ID")
    type: str = Field(..., description="Notification type category")
    title: str = Field(..., description="Notification headline")
    message: str = Field(..., description="Notification body content")
    action_url: Optional[str] = Field(default=None, description="Optional deep-link route")
    is_read: bool = Field(default=False, description="Whether notification has been read")
    created_at: Optional[datetime] = Field(default=None, description="Creation timestamp")

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    """Response containing a paginated list of notifications with unread count."""

    notifications: List[NotificationResponse]
    unread_count: int = Field(..., description="Number of unread notifications for this user")
    total: int = Field(..., description="Total notifications returned")


class NotificationMarkReadResponse(BaseModel):
    """Confirmation response after marking a notification as read."""

    id: str = Field(..., description="Notification document ID")
    is_read: bool = Field(..., description="Updated read status (always True)")
    message: str = Field(..., description="Confirmation message")
