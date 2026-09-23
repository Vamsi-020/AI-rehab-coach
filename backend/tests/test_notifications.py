"""Phase 17 — Patient Prescribed Routine, Notifications & Recovery Milestone Tests.

Covers:
- GET /api/v1/assignments/my-routine (patient scoped, authentication required)
- GET /api/v1/notifications (patient notifications, authentication required)
- PATCH /api/v1/notifications/{id}/read (mark as read with ownership enforcement)
- Recovery milestone idempotency logic
- notification_service unit logic
"""

import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId
import pytest
from fastapi.testclient import TestClient

from backend.app.core.security import create_access_token
from backend.app.factory import create_application
from backend.app.models.notification import NotificationType
from backend.app.services import notification_service

app = create_application()
client = TestClient(app, raise_server_exceptions=False)

_MY_ROUTINE_URL = "/api/v1/assignments/my-routine"
_NOTIFICATIONS_URL = "/api/v1/notifications"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _run_async(coro):
    """Run an async coroutine safely in tests (Python 3.10+ compatible)."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _make_user(role: str = "patient", user_id: str = None) -> dict:
    return {
        "_id": ObjectId(user_id) if user_id else ObjectId(),
        "full_name": "Alex Patient",
        "email": f"{role}@rehab.org",
        "hashed_password": "hashedpw",
        "role": role,
        "is_active": True,
    }


def _auth_header(user: dict) -> dict:
    token = create_access_token(str(user["_id"]))
    return {"Authorization": f"Bearer {token}"}


def _make_mock_col(find_one_val=None, find_list=None, count_val=None):
    col = MagicMock()
    col.find_one = AsyncMock(return_value=find_one_val)
    cursor = MagicMock()
    cursor.to_list = AsyncMock(return_value=find_list or [])
    cursor.sort = MagicMock(return_value=cursor)
    cursor.limit = MagicMock(return_value=cursor)
    col.find = MagicMock(return_value=cursor)
    col.count_documents = AsyncMock(return_value=count_val if count_val is not None else len(find_list or []))
    col.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
    col.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
    return col


def _make_assignment_doc(patient_user_id, exercise_name="Knee Flexion", status="active"):
    return {
        "_id": ObjectId(),
        "patient_id": patient_user_id,
        "therapist_id": ObjectId(),
        "exercise_id": ObjectId(),
        "exercise_name": exercise_name,
        "exercise_slug": "knee-flexion",
        "target_joint": "knee",
        "prescribed_sets": 3,
        "prescribed_reps": 12,
        "frequency_per_week": 5,
        "target_rom_degrees": 130.0,
        "custom_instructions": "Keep back straight.",
        "start_date": datetime.utcnow().isoformat(),
        "end_date": None,
        "status": status,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }


def _make_notification_doc(recipient_user_id, notif_type="milestone_unlocked", is_read=False):
    return {
        "_id": ObjectId(),
        "recipient_user_id": recipient_user_id,
        "type": notif_type,
        "title": "Activity Streak — First 3 Sessions",
        "message": "Consistency milestone: You have logged 3 rehabilitation sessions.",
        "action_url": "#progress",
        "is_read": is_read,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }


# ---------------------------------------------------------------------------
# 1. GET /api/v1/assignments/my-routine
# ---------------------------------------------------------------------------

class TestMyRoutineEndpoint:
    """Tests for patient self-service routine retrieval."""

    def test_unauthenticated_request_rejected(self):
        """Unauthenticated requests must return HTTP 401."""
        response = client.get(_MY_ROUTINE_URL)
        assert response.status_code == 401, (
            f"Expected 401 for unauthenticated my-routine request, got {response.status_code}"
        )

    @patch("backend.app.database.connection.db_manager.get_collection")
    def test_authenticated_patient_gets_routine(self, mock_get_col):
        """Authenticated patient receives assignment list (200 with mocked DB)."""
        user = _make_user("patient")
        headers = _auth_header(user)

        # The auth chain queries 'users' collection; my-routine queries 'exercise_assignments' + 'exercises'
        mock_users = _make_mock_col(find_one_val=user)
        mock_assignments = _make_mock_col(find_list=[])
        mock_exercises = _make_mock_col(find_one_val=None)

        def col_router(name):
            if name == "users":
                return mock_users
            if name == "exercise_assignments":
                return mock_assignments
            if name == "exercises":
                return mock_exercises
            return _make_mock_col()

        mock_get_col.side_effect = col_router
        response = client.get(_MY_ROUTINE_URL, headers=headers)
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text}"
        )
        body = response.json()
        assert "assignments" in body
        assert body["total"] == 0

    def test_my_routine_returns_only_active_assignments(self):
        """Service layer only returns active status assignments."""
        user = _make_user("patient")
        uid = str(user["_id"])

        active_doc = _make_assignment_doc(uid, status="active")

        mock_assignments_col = _make_mock_col(find_list=[active_doc])
        mock_exercises_col = _make_mock_col(find_one_val=None)

        def get_col_side_effect(name):
            from backend.app.database.collections import Collections
            if name == Collections.EXERCISE_ASSIGNMENTS:
                return mock_assignments_col
            return mock_exercises_col

        from backend.app.services.assignment_service import get_my_active_routine

        async def run():
            with patch(
                "backend.app.database.connection.db_manager.get_collection",
                side_effect=get_col_side_effect,
            ):
                results = await get_my_active_routine(uid)
            return results

        results = _run_async(run())
        for r in results:
            assert r.status == "active", f"Expected active status, got {r.status}"


# ---------------------------------------------------------------------------
# 2. GET /api/v1/notifications
# ---------------------------------------------------------------------------

class TestNotificationsEndpoint:
    """Tests for patient notification list retrieval."""

    def test_unauthenticated_request_rejected(self):
        """Unauthenticated requests must return HTTP 401."""
        response = client.get(_NOTIFICATIONS_URL)
        assert response.status_code == 401, (
            f"Expected 401 for unauthenticated notifications request, got {response.status_code}"
        )

    @patch("backend.app.database.connection.db_manager.get_collection")
    def test_authenticated_user_can_fetch_notifications(self, mock_get_col):
        """Authenticated user receives notifications list (200)."""
        user = _make_user("patient")
        headers = _auth_header(user)
        uid = user["_id"]

        notif_doc = _make_notification_doc(uid, is_read=False)
        mock_users = _make_mock_col(find_one_val=user)
        mock_notifs = _make_mock_col(find_list=[notif_doc])

        def col_router(name):
            if name == "users":
                return mock_users
            return mock_notifs

        mock_get_col.side_effect = col_router
        response = client.get(_NOTIFICATIONS_URL, headers=headers)
        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text}"
        )

    def test_notification_response_schema(self):
        """notification_service.get_patient_notifications returns correct schema."""
        from backend.app.services.notification_service import get_patient_notifications

        user = _make_user("patient")
        uid = str(user["_id"])
        notif_doc = _make_notification_doc(ObjectId(uid), is_read=False)
        notif_doc_read = _make_notification_doc(ObjectId(uid), is_read=True)

        mock_col = _make_mock_col(find_list=[notif_doc, notif_doc_read])

        async def run():
            with patch(
                "backend.app.database.connection.db_manager.get_collection",
                return_value=mock_col,
            ):
                return await get_patient_notifications(uid)

        result = _run_async(run())
        assert result.total == 2, f"Expected 2 notifications, got {result.total}"
        assert result.unread_count == 1, f"Expected 1 unread, got {result.unread_count}"
        assert len(result.notifications) == 2


# ---------------------------------------------------------------------------
# 3. PATCH /api/v1/notifications/{id}/read
# ---------------------------------------------------------------------------

class TestMarkNotificationReadEndpoint:
    """Tests for marking a notification as read."""

    def test_unauthenticated_request_rejected(self):
        """Unauthenticated PATCH must return HTTP 401."""
        fake_id = str(ObjectId())
        response = client.patch(f"{_NOTIFICATIONS_URL}/{fake_id}/read")
        assert response.status_code == 401, (
            f"Expected 401 for unauthenticated mark-read, got {response.status_code}"
        )

    def test_invalid_object_id_returns_400(self):
        """Invalid notification ID format should return 400."""
        from backend.app.services.notification_service import mark_notification_as_read
        from fastapi import HTTPException

        async def run():
            try:
                return await mark_notification_as_read("user123", "not-a-valid-object-id")
            except HTTPException as exc:
                return exc

        result = _run_async(run())
        assert isinstance(result, HTTPException), "Expected HTTPException for invalid ID"
        assert result.status_code == 400, f"Expected 400, got {result.status_code}"

    def test_mark_read_ownership_enforcement(self):
        """mark_notification_as_read must raise 403 if recipient doesn't match."""
        from backend.app.services.notification_service import mark_notification_as_read
        from fastapi import HTTPException

        owner_id = ObjectId()
        other_id = ObjectId()
        notif_id = ObjectId()

        notif_doc = {
            "_id": notif_id,
            "recipient_user_id": owner_id,
            "type": "milestone_unlocked",
            "title": "Test",
            "message": "Test message",
            "action_url": None,
            "is_read": False,
            "created_at": datetime.utcnow(),
        }
        mock_col = _make_mock_col(find_one_val=notif_doc)

        async def run():
            with patch(
                "backend.app.database.connection.db_manager.get_collection",
                return_value=mock_col,
            ):
                try:
                    return await mark_notification_as_read(str(other_id), str(notif_id))
                except HTTPException as exc:
                    return exc

        result = _run_async(run())
        assert isinstance(result, HTTPException), "Expected HTTPException for wrong recipient"
        assert result.status_code == 403, f"Expected 403, got {result.status_code}"

    def test_mark_read_not_found_returns_404(self):
        """mark_notification_as_read must raise 404 for nonexistent notification."""
        from backend.app.services.notification_service import mark_notification_as_read
        from fastapi import HTTPException

        nonexistent_id = str(ObjectId())
        user_id = str(ObjectId())

        mock_col = _make_mock_col(find_one_val=None)

        async def run():
            with patch(
                "backend.app.database.connection.db_manager.get_collection",
                return_value=mock_col,
            ):
                try:
                    return await mark_notification_as_read(user_id, nonexistent_id)
                except HTTPException as exc:
                    return exc

        result = _run_async(run())
        assert isinstance(result, HTTPException), "Expected HTTPException for 404"
        assert result.status_code == 404, f"Expected 404, got {result.status_code}"


# ---------------------------------------------------------------------------
# 4. Recovery Milestone Engine
# ---------------------------------------------------------------------------

class TestMilestoneEngine:
    """Tests for recovery milestone evaluation and notification creation."""

    def test_consistency_milestone_triggered_at_3_sessions(self):
        """3+ sessions should trigger the first consistency milestone notification."""
        from backend.app.services.notification_service import evaluate_recovery_milestones

        user = _make_user("patient")
        uid = str(user["_id"])

        session_doc = {
            "_id": ObjectId(),
            "patient_id": uid,
            "average_form_accuracy_pct": 70.0,
            "peak_angle_degrees": 90.0,
            "created_at": datetime.utcnow(),
        }

        mock_sessions_col = _make_mock_col(count_val=3)
        mock_notif_col = _make_mock_col(find_one_val=None, find_list=[])

        def get_col_side_effect(name):
            from backend.app.database.collections import Collections
            if name == Collections.REHABILITATION_SESSIONS:
                return mock_sessions_col
            return mock_notif_col

        async def run():
            with patch(
                "backend.app.database.connection.db_manager.get_collection",
                side_effect=get_col_side_effect,
            ):
                return await evaluate_recovery_milestones(uid, session_doc)

        results = _run_async(run())
        assert len(results) >= 1, f"Expected at least 1 milestone notification, got {len(results)}"
        titles = [r.title for r in results]
        assert any("3 Sessions" in t or "Streak" in t or "Consistency" in t for t in titles), (
            f"Expected consistency milestone, found titles: {titles}"
        )

    def test_milestone_idempotency_prevents_duplicates(self):
        """evaluate_recovery_milestones should NOT create duplicate milestone notifications."""
        from backend.app.services.notification_service import evaluate_recovery_milestones

        user = _make_user("patient")
        uid = str(user["_id"])

        session_doc = {
            "_id": ObjectId(),
            "patient_id": uid,
            "average_form_accuracy_pct": 70.0,
            "peak_angle_degrees": 90.0,
            "created_at": datetime.utcnow(),
        }

        existing_notif_doc = {
            "_id": ObjectId(),
            "recipient_user_id": ObjectId(uid),
            "type": "milestone_unlocked",
            "title": "Activity Streak — First 3 Sessions",
            "message": "Already sent.",
            "is_read": False,
            "created_at": datetime.utcnow(),
        }

        mock_sessions_col = _make_mock_col(count_val=3)
        # find_one returns existing doc (idempotency guard: milestone already exists)
        mock_notif_col = _make_mock_col(find_one_val=existing_notif_doc, find_list=[existing_notif_doc])

        def get_col_side_effect(name):
            from backend.app.database.collections import Collections
            if name == Collections.REHABILITATION_SESSIONS:
                return mock_sessions_col
            return mock_notif_col

        async def run():
            with patch(
                "backend.app.database.connection.db_manager.get_collection",
                side_effect=get_col_side_effect,
            ):
                return await evaluate_recovery_milestones(uid, session_doc)

        results = _run_async(run())
        streak_3_notifs = [r for r in results if "3 Sessions" in r.title]
        assert len(streak_3_notifs) == 0, (
            f"Idempotency failure: milestone 'First 3 Sessions' was triggered again when already sent"
        )

    def test_form_milestone_triggered_at_90_percent(self):
        """Session with form accuracy >= 90% should trigger form milestone."""
        from backend.app.services.notification_service import evaluate_recovery_milestones

        user = _make_user("patient")
        uid = str(user["_id"])

        session_doc = {
            "_id": ObjectId(),
            "patient_id": uid,
            "average_form_accuracy_pct": 95.0,
            "peak_angle_degrees": 80.0,
            "created_at": datetime.utcnow(),
        }

        mock_sessions_col = _make_mock_col(count_val=1)
        mock_notif_col = _make_mock_col(find_one_val=None, find_list=[])

        def get_col_side_effect(name):
            from backend.app.database.collections import Collections
            if name == Collections.REHABILITATION_SESSIONS:
                return mock_sessions_col
            return mock_notif_col

        async def run():
            with patch(
                "backend.app.database.connection.db_manager.get_collection",
                side_effect=get_col_side_effect,
            ):
                return await evaluate_recovery_milestones(uid, session_doc)

        results = _run_async(run())
        titles = [r.title for r in results]
        assert any("Form" in t or "Accuracy" in t or "Precision" in t for t in titles), (
            f"Expected form milestone, found titles: {titles}"
        )

    def test_rom_milestone_triggered_at_120_degrees(self):
        """Session with peak angle >= 120° should trigger ROM milestone."""
        from backend.app.services.notification_service import evaluate_recovery_milestones

        user = _make_user("patient")
        uid = str(user["_id"])

        session_doc = {
            "_id": ObjectId(),
            "patient_id": uid,
            "average_form_accuracy_pct": 70.0,
            "peak_angle_degrees": 125.0,
            "created_at": datetime.utcnow(),
        }

        mock_sessions_col = _make_mock_col(count_val=1)
        mock_notif_col = _make_mock_col(find_one_val=None, find_list=[])

        def get_col_side_effect(name):
            from backend.app.database.collections import Collections
            if name == Collections.REHABILITATION_SESSIONS:
                return mock_sessions_col
            return mock_notif_col

        async def run():
            with patch(
                "backend.app.database.connection.db_manager.get_collection",
                side_effect=get_col_side_effect,
            ):
                return await evaluate_recovery_milestones(uid, session_doc)

        results = _run_async(run())
        titles = [r.title for r in results]
        assert any("ROM" in t or "120" in t or "Angle" in t for t in titles), (
            f"Expected ROM milestone, found titles: {titles}"
        )

    def test_milestone_language_is_neutral(self):
        """Milestone messages must not contain clinical clearance or medical diagnosis language."""
        from backend.app.services.notification_service import evaluate_recovery_milestones

        user = _make_user("patient")
        uid = str(user["_id"])

        session_doc = {
            "_id": ObjectId(),
            "patient_id": uid,
            "average_form_accuracy_pct": 95.0,
            "peak_angle_degrees": 125.0,
            "created_at": datetime.utcnow(),
        }

        mock_sessions_col = _make_mock_col(count_val=5)
        mock_notif_col = _make_mock_col(find_one_val=None, find_list=[])

        def get_col_side_effect(name):
            from backend.app.database.collections import Collections
            if name == Collections.REHABILITATION_SESSIONS:
                return mock_sessions_col
            return mock_notif_col

        async def run():
            with patch(
                "backend.app.database.connection.db_manager.get_collection",
                side_effect=get_col_side_effect,
            ):
                return await evaluate_recovery_milestones(uid, session_doc)

        results = _run_async(run())
        forbidden_phrases = ["cleared", "discharged", "recovered", "cured", "diagnosis", "prescribe"]
        for notif in results:
            text = (notif.title + " " + notif.message).lower()
            for phrase in forbidden_phrases:
                assert phrase not in text, (
                    f"Milestone contains forbidden clinical language '{phrase}': {notif.message}"
                )


# ---------------------------------------------------------------------------
# 5. Notification Service Unit Tests
# ---------------------------------------------------------------------------

class TestNotificationServiceUnit:
    """Unit tests for notification_service helper functions."""

    def test_id_variants_returns_both_str_and_objectid(self):
        """_id_variants should return both string and ObjectId for valid IDs."""
        from backend.app.services.notification_service import _id_variants
        oid = ObjectId()
        variants = _id_variants(str(oid))
        assert str(oid) in variants, "String ID should be in variants"
        assert oid in variants, "ObjectId should be in variants"

    def test_id_variants_with_invalid_id(self):
        """_id_variants with invalid ObjectId should return only string."""
        from backend.app.services.notification_service import _id_variants
        invalid_id = "not-an-objectid"
        variants = _id_variants(invalid_id)
        assert invalid_id in variants
        assert len(variants) == 1, "Only string variant should be returned for invalid ID"

    def test_notification_type_enum_values(self):
        """NotificationType enum should have all expected Phase 17 values."""
        assert NotificationType.MILESTONE_UNLOCKED.value == "milestone_unlocked"
        assert NotificationType.ROUTINE_REMINDER.value == "routine_reminder"
        assert NotificationType.CLINICAL_FEEDBACK.value == "clinical_feedback"
        assert NotificationType.KINEMATIC_ALERT.value == "kinematic_alert"
        assert NotificationType.SYSTEM.value == "system"

    def test_create_notification_inserts_document(self):
        """create_notification should call insert_one on the notifications collection."""
        from backend.app.services.notification_service import create_notification

        user_id = str(ObjectId())
        mock_col = _make_mock_col()

        async def run():
            with patch(
                "backend.app.database.connection.db_manager.get_collection",
                return_value=mock_col,
            ):
                return await create_notification(
                    recipient_user_id=user_id,
                    notification_type=NotificationType.ROUTINE_REMINDER,
                    title="Test Reminder",
                    message="Time to do your exercises.",
                    action_url="#session",
                )

        result = _run_async(run())
        assert result.title == "Test Reminder"
        assert result.type == NotificationType.ROUTINE_REMINDER.value
        assert result.is_read is False
        mock_col.insert_one.assert_called_once()
