"""Notification service layer (Phase 17).

Responsibilities:
- Create new notifications for patients (routine reminders, clinical feedback, milestones, kinematic alerts)
- Retrieve patient notifications scoped strictly to the authenticated recipient
- Calculate unread notification count
- Mark an individual notification as read (with ownership enforcement)
- Evaluate recovery milestones based on stored session data and trigger milestone notifications
  with idempotency checks to prevent duplicate notifications

IMPORTANT: This service never trusts a patient_id supplied by the client.
All data access is scoped to the authenticated user's ID.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import HTTPException, status

from backend.app.database.collections import Collections
from backend.app.database.connection import db_manager
from backend.app.models.notification import NotificationModel, NotificationType
from backend.app.schemas.notification import (
    NotificationListResponse,
    NotificationMarkReadResponse,
    NotificationResponse,
)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_col(name: str):
    """Retrieve MongoDB collection or raise HTTP 503 if unavailable."""
    col = db_manager.get_collection(name)
    if col is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database collection '{name}' is currently unavailable.",
        )
    return col


def _notification_doc_to_response(doc: Dict[str, Any]) -> NotificationResponse:
    """Convert a raw MongoDB notification document to NotificationResponse."""
    return NotificationResponse(
        id=str(doc["_id"]),
        recipient_user_id=str(doc.get("recipient_user_id", "")),
        type=str(doc.get("type", "system")),
        title=str(doc.get("title", "")),
        message=str(doc.get("message", "")),
        action_url=doc.get("action_url"),
        is_read=bool(doc.get("is_read", False)),
        created_at=doc.get("created_at"),
    )


# ---------------------------------------------------------------------------
# Core Notification Operations
# ---------------------------------------------------------------------------

async def create_notification(
    recipient_user_id: str,
    notification_type: NotificationType,
    title: str,
    message: str,
    action_url: Optional[str] = None,
) -> NotificationResponse:
    """Insert a new notification document for the given recipient.

    Args:
        recipient_user_id: The authenticated patient's user ID (from JWT, never from client).
        notification_type: One of the NotificationType enum values.
        title: Short notification headline.
        message: Full notification body content.
        action_url: Optional deep-link route for the notification action.

    Returns:
        The created NotificationResponse.
    """
    col = _get_col(Collections.NOTIFICATIONS)
    now = datetime.utcnow()

    recipient_obj = ObjectId(recipient_user_id) if ObjectId.is_valid(recipient_user_id) else recipient_user_id

    doc = {
        "_id": ObjectId(),
        "recipient_user_id": recipient_obj,
        "type": notification_type.value,
        "title": title,
        "message": message,
        "action_url": action_url,
        "is_read": False,
        "created_at": now,
        "updated_at": now,
    }

    await col.insert_one(doc)
    return _notification_doc_to_response(doc)


async def get_patient_notifications(
    recipient_user_id: str,
    limit: int = 50,
) -> NotificationListResponse:
    """Retrieve paginated notifications strictly scoped to the authenticated recipient.

    Args:
        recipient_user_id: The authenticated user's ID from JWT (never from client).
        limit: Maximum number of notifications to return.

    Returns:
        NotificationListResponse with notifications, unread_count, and total.
    """
    col = _get_col(Collections.NOTIFICATIONS)

    # Build an OR query to handle both ObjectId and string variants stored in DB
    query: Dict[str, Any] = {"recipient_user_id": {"$in": _id_variants(recipient_user_id)}}

    cursor = col.find(query).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)

    notifications = [_notification_doc_to_response(doc) for doc in docs]
    unread_count = sum(1 for n in notifications if not n.is_read)

    return NotificationListResponse(
        notifications=notifications,
        unread_count=unread_count,
        total=len(notifications),
    )


async def mark_notification_as_read(
    recipient_user_id: str,
    notification_id: str,
) -> NotificationMarkReadResponse:
    """Mark a specific notification as read, enforcing recipient ownership.

    Args:
        recipient_user_id: Authenticated user's ID from JWT.
        notification_id: The notification document ID to mark as read.

    Raises:
        HTTP 400 if notification_id is not a valid ObjectId.
        HTTP 404 if the notification does not exist.
        HTTP 403 if the notification does not belong to the authenticated user.

    Returns:
        NotificationMarkReadResponse confirming the operation.
    """
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid notification ID format.",
        )

    col = _get_col(Collections.NOTIFICATIONS)

    doc = await col.find_one({"_id": ObjectId(notification_id)})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )

    # Enforce recipient ownership — the notification's recipient_user_id must match
    doc_recipient = str(doc.get("recipient_user_id", ""))
    if doc_recipient != recipient_user_id and doc_recipient != str(
        ObjectId(recipient_user_id) if ObjectId.is_valid(recipient_user_id) else recipient_user_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: This notification does not belong to your account.",
        )

    await col.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"is_read": True, "updated_at": datetime.utcnow()}},
    )

    return NotificationMarkReadResponse(
        id=notification_id,
        is_read=True,
        message="Notification marked as read.",
    )


# ---------------------------------------------------------------------------
# Recovery Milestone Engine
# ---------------------------------------------------------------------------

# Milestone definitions (title → condition check function name)
_MILESTONE_DEFINITIONS = [
    {
        "title": "Activity Streak — First 3 Sessions",
        "type": NotificationType.MILESTONE_UNLOCKED,
        "message": (
            "Consistency milestone: You have logged 3 rehabilitation sessions. "
            "Keep up the steady activity to build long-term progress."
        ),
        "action_url": "#progress",
        "condition": "sessions_gte_3",
    },
    {
        "title": "Activity Streak — 5 Sessions Logged",
        "type": NotificationType.MILESTONE_UNLOCKED,
        "message": (
            "Consistency milestone: You have now logged 5 rehabilitation sessions. "
            "Your regular activity has been recorded."
        ),
        "action_url": "#progress",
        "condition": "sessions_gte_5",
    },
    {
        "title": "Form Milestone — High Accuracy Session",
        "type": NotificationType.MILESTONE_UNLOCKED,
        "message": (
            "Form milestone: A session with 90% or greater form accuracy score has been recorded. "
            "This reflects precise movement execution during your exercise."
        ),
        "action_url": "#progress",
        "condition": "form_gte_90",
    },
    {
        "title": "ROM Target Recorded — 120° Peak Angle",
        "type": NotificationType.MILESTONE_UNLOCKED,
        "message": (
            "ROM target recorded: A peak joint angle of 120° or greater has been logged in your session. "
            "This data has been saved to your progress record."
        ),
        "action_url": "#progress",
        "condition": "rom_gte_120",
    },
]


def _id_variants(user_id: str) -> List[Any]:
    """Return a list of ObjectId and string variants for a user ID, for flexible DB queries."""
    variants: List[Any] = [user_id]
    if ObjectId.is_valid(user_id):
        variants.append(ObjectId(user_id))
    return variants


async def _milestone_already_exists(
    col,
    recipient_user_id: str,
    title: str,
) -> bool:
    """Check if a milestone notification with this title already exists for this user.

    This is the idempotency guard — prevents the same milestone from being
    sent multiple times.
    """
    query = {
        "recipient_user_id": {"$in": _id_variants(recipient_user_id)},
        "title": title,
        "type": NotificationType.MILESTONE_UNLOCKED.value,
    }
    existing = await col.find_one(query)
    return existing is not None


async def evaluate_recovery_milestones(
    patient_user_id: str,
    latest_session_doc: Dict[str, Any],
) -> List[NotificationResponse]:
    """Evaluate recovery milestones and create notifications for newly unlocked ones.

    Called after each session is saved. Checks all milestone conditions and
    inserts a notification for any milestone that:
    1. Has its condition met.
    2. Has NOT already been notified (idempotency check).

    Milestone types:
    - Consistency milestones: Based on total session count (3+, 5+).
    - Form milestone: Session form accuracy >= 90%.
    - ROM milestone: Peak angle >= 120°.

    Uses only neutral application language — no medical claims or clinical clearance.

    Args:
        patient_user_id: The authenticated patient's user ID.
        latest_session_doc: The newly created session document.

    Returns:
        List of NotificationResponse for any newly unlocked milestones (may be empty).
    """
    sessions_col = _get_col(Collections.REHABILITATION_SESSIONS)
    notif_col = _get_col(Collections.NOTIFICATIONS)

    # Count all sessions for this patient
    sessions_query = {"patient_id": {"$in": _id_variants(patient_user_id)}}
    try:
        total_sessions = await sessions_col.count_documents(sessions_query)
    except Exception:
        total_sessions = 0

    # Extract metrics from latest session
    form_accuracy = float(latest_session_doc.get("average_form_accuracy_pct", 0) or 0)
    peak_angle = float(latest_session_doc.get("peak_angle_degrees", 0) or 0)

    # Map condition names to evaluation results
    condition_results = {
        "sessions_gte_3": total_sessions >= 3,
        "sessions_gte_5": total_sessions >= 5,
        "form_gte_90": form_accuracy >= 90.0,
        "rom_gte_120": peak_angle >= 120.0,
    }

    created_notifications: List[NotificationResponse] = []

    for milestone in _MILESTONE_DEFINITIONS:
        condition_key = milestone["condition"]
        if not condition_results.get(condition_key, False):
            continue

        # Idempotency check: skip if this milestone has already been sent
        already_sent = await _milestone_already_exists(
            notif_col, patient_user_id, milestone["title"]
        )
        if already_sent:
            continue

        # Create the milestone notification
        notif = await create_notification(
            recipient_user_id=patient_user_id,
            notification_type=milestone["type"],
            title=milestone["title"],
            message=milestone["message"],
            action_url=milestone.get("action_url"),
        )
        created_notifications.append(notif)

    return created_notifications
