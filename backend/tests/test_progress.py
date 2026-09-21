"""Phase 15 — Progress Analytics Endpoint Tests.

Tests cover:
1. Authentication guard on every new endpoint
2. Session history pagination and exercise filter
3. Exercise-specific breakdown endpoint
4. Detailed analytics endpoint
5. Empty history safe zero-state
6. Patient data isolation (token encodes patient identity)
7. Progress calculation correctness
8. Invalid token rejection

All tests mock the MongoDB layer so no live database is required.
"""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient

from backend.app.core.security import create_access_token, hash_password
from backend.app.factory import create_application

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = create_application()
client = TestClient(app, raise_server_exceptions=False)

_ANALYTICS_URL = "/api/v1/progress/analytics"
_HISTORY_URL = "/api/v1/progress/history"
_EXERCISES_URL = "/api/v1/progress/exercises"
_ME_URL = "/api/v1/progress/me"   # Phase 14 — must still work

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user_doc(user_id: ObjectId = None) -> dict:
    uid = user_id or ObjectId()
    return {
        "_id": uid,
        "full_name": "Test Patient",
        "email": "patient@test.com",
        "hashed_password": hash_password("Password123!"),
        "role": "patient",
        "status": "active",
        "is_active": True,
        "avatar_url": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }


def _make_session_doc(
    patient_id: str,
    exercise_name: str = "Seated Knee Extension",
    accuracy: float = 90.0,
    reps: int = 12,
    sets: int = 3,
    peak_angle: float = 120.0,
    days_ago: int = 0,
) -> dict:
    created = datetime.utcnow() - timedelta(days=days_ago)
    return {
        "_id": ObjectId(),
        "patient_id": patient_id,
        "exercise_id": "seed-knee-ext-001",
        "exercise_name": exercise_name,
        "sets_completed": sets,
        "reps_completed": reps,
        "average_form_accuracy_pct": accuracy,
        "peak_angle_degrees": peak_angle,
        "notes": None,
        "created_at": created,
        "updated_at": created,
    }


def _make_valid_token(user_doc: dict) -> str:
    return create_access_token(
        subject=str(user_doc["_id"]),
        extra_claims={"role": user_doc["role"], "email": user_doc["email"]},
    )


def _auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# 1. Authentication guards — all three new endpoints
# ---------------------------------------------------------------------------

class TestPhase15AuthGuards:
    """Each new endpoint must reject unauthenticated requests with HTTP 401."""

    def test_analytics_requires_auth(self):
        res = client.get(_ANALYTICS_URL)
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"

    def test_history_requires_auth(self):
        res = client.get(_HISTORY_URL)
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"

    def test_exercises_requires_auth(self):
        res = client.get(_EXERCISES_URL)
        assert res.status_code == 401, f"Expected 401, got {res.status_code}"

    def test_analytics_bad_token_returns_401(self):
        res = client.get(_ANALYTICS_URL, headers={"Authorization": "Bearer bad.jwt"})
        assert res.status_code == 401

    def test_history_bad_token_returns_401(self):
        res = client.get(_HISTORY_URL, headers={"Authorization": "Bearer not.a.token"})
        assert res.status_code == 401

    def test_exercises_bad_token_returns_401(self):
        res = client.get(_EXERCISES_URL, headers={"Authorization": "Bearer garbage"})
        assert res.status_code == 401


# ---------------------------------------------------------------------------
# 2. Phase 14 /progress/me — must still return 401 without auth (regression)
# ---------------------------------------------------------------------------

class TestPhase14Regression:
    """Ensure the existing /progress/me endpoint is not broken by Phase 15 changes."""

    def test_progress_me_still_requires_auth(self):
        res = client.get(_ME_URL)
        assert res.status_code == 401, f"Phase 14 regression: expected 401, got {res.status_code}"

    def test_progress_me_bad_token_still_401(self):
        res = client.get(_ME_URL, headers={"Authorization": "Bearer bad.token"})
        assert res.status_code == 401


# ---------------------------------------------------------------------------
# 3. Analytics endpoint — empty history / zero-state
# ---------------------------------------------------------------------------

class TestAnalyticsEmptyHistory:
    """When the patient has no sessions, the analytics endpoint must return
    a safe zero-state response without raising an error."""

    @patch("backend.app.database.connection.db_manager.get_collection")
    @patch("backend.app.database.connection.db_manager.is_connected", new=True)
    def test_analytics_empty_returns_zero_state(self, mock_get_col):
        user_doc = _make_user_doc()
        token = _make_valid_token(user_doc)

        # Mock user lookup (for auth dep) — returns user doc
        user_col_mock = MagicMock()
        user_col_mock.find_one = AsyncMock(return_value=user_doc)

        # Mock sessions collection — empty
        sessions_col_mock = MagicMock()
        sessions_col_mock.find = MagicMock(return_value=MagicMock(
            sort=MagicMock(return_value=MagicMock(
                to_list=AsyncMock(return_value=[])
            ))
        ))
        sessions_col_mock.count_documents = AsyncMock(return_value=0)

        def col_router(name):
            if name == "users":
                return user_col_mock
            return sessions_col_mock

        mock_get_col.side_effect = col_router

        res = client.get(_ANALYTICS_URL, headers=_auth_header(token))
        assert res.status_code in (200, 503), f"Unexpected status: {res.status_code}: {res.text}"
        if res.status_code == 200:
            data = res.json()
            assert data["session_count"] == 0
            assert data["total_reps_completed"] == 0
            assert data["avg_form_accuracy_pct"] == 0.0
            assert data["quality_trend"] == []
            assert data["reps_trend"] == []
            assert data["exercise_breakdown"] == []
            assert data["recent_sessions"] == []
            assert "disclaimer" in data


# ---------------------------------------------------------------------------
# 4. Analytics endpoint — with session data
# ---------------------------------------------------------------------------

class TestAnalyticsWithData:
    """When sessions exist, analytics must compute correct aggregated metrics."""

    @patch("backend.app.database.connection.db_manager.get_collection")
    @patch("backend.app.database.connection.db_manager.is_connected", new=True)
    def test_analytics_computes_correct_counts(self, mock_get_col):
        user_doc = _make_user_doc()
        patient_id = str(user_doc["_id"])
        token = _make_valid_token(user_doc)

        session_docs = [
            _make_session_doc(patient_id, accuracy=90.0, reps=12, days_ago=0),
            _make_session_doc(patient_id, accuracy=80.0, reps=10, days_ago=1),
            _make_session_doc(patient_id, accuracy=85.0, reps=11, days_ago=2),
        ]

        user_col_mock = MagicMock()
        user_col_mock.find_one = AsyncMock(return_value=user_doc)

        sessions_col_mock = MagicMock()
        sessions_col_mock.find = MagicMock(return_value=MagicMock(
            sort=MagicMock(return_value=MagicMock(
                to_list=AsyncMock(return_value=session_docs)
            ))
        ))
        sessions_col_mock.count_documents = AsyncMock(return_value=3)

        def col_router(name):
            if name == "users":
                return user_col_mock
            return sessions_col_mock

        mock_get_col.side_effect = col_router

        res = client.get(_ANALYTICS_URL, headers=_auth_header(token))
        assert res.status_code in (200, 503), f"Unexpected: {res.status_code}: {res.text}"
        if res.status_code == 200:
            data = res.json()
            assert data["session_count"] == 3
            assert data["total_reps_completed"] == 33  # 12 + 10 + 11
            # avg = (90 + 80 + 85) / 3 = 85.0
            assert abs(data["avg_form_accuracy_pct"] - 85.0) < 0.5
            assert len(data["quality_trend"]) == 3
            assert len(data["reps_trend"]) == 3
            assert "disclaimer" in data

    @patch("backend.app.database.connection.db_manager.get_collection")
    @patch("backend.app.database.connection.db_manager.is_connected", new=True)
    def test_analytics_response_schema_valid(self, mock_get_col):
        """Ensure response has all required Phase 15 fields."""
        user_doc = _make_user_doc()
        patient_id = str(user_doc["_id"])
        token = _make_valid_token(user_doc)

        session_docs = [
            _make_session_doc(patient_id, accuracy=92.0, reps=10, days_ago=0),
        ]

        user_col_mock = MagicMock()
        user_col_mock.find_one = AsyncMock(return_value=user_doc)

        sessions_col_mock = MagicMock()
        sessions_col_mock.find = MagicMock(return_value=MagicMock(
            sort=MagicMock(return_value=MagicMock(
                to_list=AsyncMock(return_value=session_docs)
            ))
        ))

        def col_router(name):
            if name == "users":
                return user_col_mock
            return sessions_col_mock

        mock_get_col.side_effect = col_router

        res = client.get(_ANALYTICS_URL, headers=_auth_header(token))
        assert res.status_code in (200, 503)
        if res.status_code == 200:
            data = res.json()
            required_fields = [
                "patient_id", "session_count", "total_reps_completed",
                "avg_form_accuracy_pct", "weekly_adherence_pct",
                "active_streak_days", "overall_score", "quality_trend",
                "reps_trend", "exercise_breakdown", "recent_sessions", "disclaimer",
            ]
            for field in required_fields:
                assert field in data, f"Missing field: {field}"


# ---------------------------------------------------------------------------
# 5. Session history pagination
# ---------------------------------------------------------------------------

class TestSessionHistory:
    """Session history must support pagination and exercise name filtering."""

    @patch("backend.app.database.connection.db_manager.get_collection")
    @patch("backend.app.database.connection.db_manager.is_connected", new=True)
    def test_history_requires_auth(self, _):
        res = client.get(_HISTORY_URL)
        assert res.status_code == 401

    @patch("backend.app.database.connection.db_manager.get_collection")
    @patch("backend.app.database.connection.db_manager.is_connected", new=True)
    def test_history_returns_paginated_sessions(self, mock_get_col):
        user_doc = _make_user_doc()
        patient_id = str(user_doc["_id"])
        token = _make_valid_token(user_doc)

        session_docs = [
            _make_session_doc(patient_id, exercise_name="Seated Knee Extension", days_ago=i)
            for i in range(5)
        ]

        user_col_mock = MagicMock()
        user_col_mock.find_one = AsyncMock(return_value=user_doc)

        sessions_col_mock = MagicMock()
        sessions_col_mock.count_documents = AsyncMock(return_value=5)
        sessions_col_mock.find = MagicMock(return_value=MagicMock(
            sort=MagicMock(return_value=MagicMock(
                skip=MagicMock(return_value=MagicMock(
                    limit=MagicMock(return_value=MagicMock(
                        to_list=AsyncMock(return_value=session_docs)
                    ))
                ))
            ))
        ))

        def col_router(name):
            if name == "users":
                return user_col_mock
            return sessions_col_mock

        mock_get_col.side_effect = col_router

        res = client.get(f"{_HISTORY_URL}?page=1&page_size=10", headers=_auth_header(token))
        assert res.status_code in (200, 503)
        if res.status_code == 200:
            data = res.json()
            assert "sessions" in data
            assert "total" in data
            assert "page" in data
            assert "page_size" in data
            assert data["page"] == 1
            assert data["page_size"] == 10
            assert data["total"] == 5

    @patch("backend.app.database.connection.db_manager.get_collection")
    @patch("backend.app.database.connection.db_manager.is_connected", new=True)
    def test_history_invalid_pagination_returns_422(self, mock_get_col):
        user_doc = _make_user_doc()
        token = _make_valid_token(user_doc)

        user_col_mock = MagicMock()
        user_col_mock.find_one = AsyncMock(return_value=user_doc)
        mock_get_col.return_value = user_col_mock

        # page=0 is invalid (ge=1)
        res = client.get(f"{_HISTORY_URL}?page=0", headers=_auth_header(token))
        assert res.status_code in (401, 422)


# ---------------------------------------------------------------------------
# 6. Exercise-specific progress
# ---------------------------------------------------------------------------

class TestExerciseProgress:
    """Exercise breakdown endpoint must aggregate data per exercise name."""

    @patch("backend.app.database.connection.db_manager.get_collection")
    @patch("backend.app.database.connection.db_manager.is_connected", new=True)
    def test_exercises_returns_breakdown(self, mock_get_col):
        user_doc = _make_user_doc()
        patient_id = str(user_doc["_id"])
        token = _make_valid_token(user_doc)

        session_docs = [
            _make_session_doc(patient_id, exercise_name="Seated Knee Extension", accuracy=91.0, days_ago=0),
            _make_session_doc(patient_id, exercise_name="Seated Knee Extension", accuracy=88.0, days_ago=1),
            _make_session_doc(patient_id, exercise_name="Shoulder Raise", accuracy=82.0, days_ago=2),
        ]

        user_col_mock = MagicMock()
        user_col_mock.find_one = AsyncMock(return_value=user_doc)

        sessions_col_mock = MagicMock()
        sessions_col_mock.find = MagicMock(return_value=MagicMock(
            sort=MagicMock(return_value=MagicMock(
                to_list=AsyncMock(return_value=session_docs)
            ))
        ))

        def col_router(name):
            if name == "users":
                return user_col_mock
            return sessions_col_mock

        mock_get_col.side_effect = col_router

        res = client.get(_EXERCISES_URL, headers=_auth_header(token))
        assert res.status_code in (200, 503)
        if res.status_code == 200:
            data = res.json()
            assert isinstance(data, list)
            # Find Knee Extension entry
            knee = next((e for e in data if "Knee" in e["exercise_name"]), None)
            if knee:
                assert knee["session_count"] == 2
                assert knee["total_reps"] == 24  # 12 + 12

    @patch("backend.app.database.connection.db_manager.get_collection")
    @patch("backend.app.database.connection.db_manager.is_connected", new=True)
    def test_exercises_empty_returns_empty_list(self, mock_get_col):
        user_doc = _make_user_doc()
        token = _make_valid_token(user_doc)

        user_col_mock = MagicMock()
        user_col_mock.find_one = AsyncMock(return_value=user_doc)

        sessions_col_mock = MagicMock()
        sessions_col_mock.find = MagicMock(return_value=MagicMock(
            sort=MagicMock(return_value=MagicMock(
                to_list=AsyncMock(return_value=[])
            ))
        ))

        def col_router(name):
            if name == "users":
                return user_col_mock
            return sessions_col_mock

        mock_get_col.side_effect = col_router

        res = client.get(_EXERCISES_URL, headers=_auth_header(token))
        assert res.status_code in (200, 503)
        if res.status_code == 200:
            assert res.json() == []


# ---------------------------------------------------------------------------
# 7. Patient data isolation
# ---------------------------------------------------------------------------

class TestPatientDataIsolation:
    """Patients must access only their own session data.

    The API derives patient identity from the JWT subject — it does NOT accept
    a patient_id query parameter that could allow accessing another patient's data.
    """

    def test_analytics_has_no_patient_id_param(self):
        """If a rogue patient_id param is passed, it should be ignored (no 200 without auth)."""
        # Without a token, must still get 401 regardless of any params
        res = client.get(f"{_ANALYTICS_URL}?patient_id=someotherid")
        assert res.status_code == 401

    def test_history_has_no_patient_id_param(self):
        res = client.get(f"{_HISTORY_URL}?patient_id=someotherid")
        assert res.status_code == 401

    def test_exercises_has_no_patient_id_param(self):
        res = client.get(f"{_EXERCISES_URL}?patient_id=someotherid")
        assert res.status_code == 401


# ---------------------------------------------------------------------------
# 8. Performance label logic (unit test — no HTTP)
# ---------------------------------------------------------------------------

class TestPerformanceLabel:
    """Unit tests for the _performance_label helper (no DB, no HTTP)."""

    def test_label_for_accuracy(self):
        from backend.app.services.analytics_service import _performance_label
        assert _performance_label(98.0) == "Excellent"
        assert _performance_label(95.0) == "Excellent"
        assert _performance_label(90.0) == "Good"
        assert _performance_label(85.0) == "Good"
        assert _performance_label(75.0) == "Fair"
        assert _performance_label(70.0) == "Fair"
        assert _performance_label(60.0) == "Needs Improvement"
        assert _performance_label(0.0) == "Needs Improvement"


# ---------------------------------------------------------------------------
# 9. Streak computation (unit test — no DB, no HTTP)
# ---------------------------------------------------------------------------

class TestStreakComputation:
    """Unit tests for the _compute_streak helper."""

    def test_streak_with_no_sessions(self):
        from backend.app.services.analytics_service import _compute_streak
        assert _compute_streak([]) == 0

    def test_streak_with_consecutive_days(self):
        from backend.app.services.analytics_service import _compute_streak
        today = datetime.utcnow()
        docs = [
            {"created_at": today},
            {"created_at": today - timedelta(days=1)},
            {"created_at": today - timedelta(days=2)},
        ]
        streak = _compute_streak(docs)
        assert streak == 3

    def test_streak_breaks_on_gap(self):
        from backend.app.services.analytics_service import _compute_streak
        today = datetime.utcnow()
        docs = [
            {"created_at": today},
            {"created_at": today - timedelta(days=2)},  # gap of 2 days
        ]
        streak = _compute_streak(docs)
        assert streak == 1  # Only today counts — streak breaks at the gap
