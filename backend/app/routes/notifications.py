"""Patient notification routes (Phase 17).

Provides:
- GET /api/v1/notifications — Retrieve all notifications for the authenticated patient
- PATCH /api/v1/notifications/{notification_id}/read — Mark a notification as read

All routes require authentication. Patient data isolation is enforced — users can
only access their own notifications.
"""

from fastapi import APIRouter, Depends, status

from backend.app.core.dependencies import get_current_active_user
from backend.app.schemas.notification import (
    NotificationListResponse,
    NotificationMarkReadResponse,
)
from backend.app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get(
    "",
    response_model=NotificationListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get My Notifications",
    description=(
        "Retrieve all notifications for the authenticated patient, ordered by newest first. "
        "Includes unread count for badge display. Patient data isolation is enforced via JWT."
    ),
)
async def get_my_notifications_endpoint(
    current_user: dict = Depends(get_current_active_user),
) -> NotificationListResponse:
    """Return all notifications for the authenticated user, scoped strictly to their account."""
    patient_user_id = str(current_user["_id"])
    return await notification_service.get_patient_notifications(patient_user_id)


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationMarkReadResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark Notification As Read",
    description=(
        "Mark a specific notification as read. "
        "Only the notification's recipient may perform this action; "
        "returns HTTP 403 if the notification belongs to another user."
    ),
)
async def mark_notification_read_endpoint(
    notification_id: str,
    current_user: dict = Depends(get_current_active_user),
) -> NotificationMarkReadResponse:
    """Mark the specified notification as read, enforcing recipient ownership."""
    patient_user_id = str(current_user["_id"])
    return await notification_service.mark_notification_as_read(patient_user_id, notification_id)
