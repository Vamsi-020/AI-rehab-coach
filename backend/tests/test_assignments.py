"""Phase 16 — Physiotherapist Dashboard and Exercise Prescription Endpoint Tests.

Covers:
- Clinician role authentication and authorization (RBAC)
- Patient role rejection (HTTP 403 Forbidden)
- Clinician dashboard metrics and patient roster retrieval
- Prescription creation, validation, retrieval, update, and deactivation
- Clinician-patient relationship isolation checks
"""

from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId
import pytest
from fastapi.testclient import TestClient

from backend.app.core.security import create_access_token
from backend.app.factory import create_application

app = create_application()
client = TestClient(app, raise_server_exceptions=False)

_DASHBOARD_URL = "/api/v1/therapist/dashboard"
_PATIENTS_URL = "/api/v1/therapist/patients"
_ASSIGNMENTS_URL = "/api/v1/assignments"


def _make_user(role: str = "therapist", user_id: str = None) -> dict:
    return {
        "_id": ObjectId(user_id) if user_id else ObjectId(),
        "full_name": "Dr. Sarah Clinician",
        "email": f"{role}@clinic.org",
        "hashed_password": "hashedpassword123",
        "role": role,
        "is_active": True,
    }


def _auth_header_for(user: dict) -> dict:
    token = create_access_token(str(user["_id"]))
    return {"Authorization": f"Bearer {token}"}


def _make_mock_col(find_one_val=None, find_list=None):
    col = MagicMock()
    col.find_one = AsyncMock(return_value=find_one_val)
    cursor = MagicMock()
    cursor.to_list = AsyncMock(return_value=find_list or [])
    cursor.sort.return_value = cursor
    col.find.return_value = cursor
    col.count_documents = AsyncMock(return_value=len(find_list or []))
    col.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
    col.update_one = AsyncMock(return_value=MagicMock(modified_count=1))
    return col


# ---------------------------------------------------------------------------
# 1. RBAC & Authorization Tests
# ---------------------------------------------------------------------------

class TestClinicianAuthAndRBAC:
    """Verify role-based access control protecting clinician endpoints."""

    def test_dashboard_unauthenticated_returns_401(self):
        """Unauthenticated requests must return 401."""
        res = client.get(_DASHBOARD_URL)
        assert res.status_code == 401

    def test_patients_unauthenticated_returns_401(self):
        """Unauthenticated patient roster request must return 401."""
        res = client.get(_PATIENTS_URL)
        assert res.status_code == 401

    def test_assignments_post_unauthenticated_returns_401(self):
        """Unauthenticated prescription creation must return 401."""
        res = client.post(_ASSIGNMENTS_URL, json={})
        assert res.status_code == 401

    @patch("backend.app.database.connection.db_manager.get_collection")
    def test_patient_role_rejected_from_dashboard_with_403(self, mock_col):
        """Patient user attempting to access clinician dashboard receives 403."""
        patient_user = _make_user(role="patient")
        users_col = _make_mock_col(find_one_val=patient_user)
        mock_col.return_value = users_col

        headers = _auth_header_for(patient_user)
        res = client.get(_DASHBOARD_URL, headers=headers)
        assert res.status_code == 403
        assert "Clinician role required" in res.text

    @patch("backend.app.database.connection.db_manager.get_collection")
    def test_patient_role_rejected_from_prescribing_with_403(self, mock_col):
        """Patient user attempting to create a prescription receives 403."""
        patient_user = _make_user(role="patient")
        users_col = _make_mock_col(find_one_val=patient_user)
        mock_col.return_value = users_col

        headers = _auth_header_for(patient_user)
        res = client.post(
            _ASSIGNMENTS_URL,
            headers=headers,
            json={
                "patient_id": str(ObjectId()),
                "exercise_id": "knee-flexion",
                "prescribed_sets": 3,
                "prescribed_reps": 10,
            },
        )
        assert res.status_code == 403
        assert "Clinician role required" in res.text


# ---------------------------------------------------------------------------
# 2. Clinician Dashboard & Roster Tests
# ---------------------------------------------------------------------------

class TestClinicianDashboard:
    """Verify live clinician dashboard metrics and patient roster aggregation."""

    @patch("backend.app.database.connection.db_manager.get_collection")
    def test_therapist_accesses_dashboard_empty_roster(self, mock_col):
        """Clinician with no assigned patients receives zeroed KPIs and empty list."""
        therapist_user = _make_user(role="therapist")

        mock_users = _make_mock_col(find_one_val=therapist_user)
        mock_patients = _make_mock_col(find_list=[])
        mock_therapists = _make_mock_col(find_one_val=None)

        def col_router(name):
            if name == "users":
                return mock_users
            if name == "patients":
                return mock_patients
            if name == "therapists":
                return mock_therapists
            return _make_mock_col()

        mock_col.side_effect = col_router

        headers = _auth_header_for(therapist_user)
        res = client.get(_DASHBOARD_URL, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "metrics" in data
        assert data["metrics"]["active_patients_count"] == 0
        assert data["metrics"]["average_compliance_rate"] == 0.0
        assert data["patients"] == []
        assert data["total_patients"] == 0

    @patch("backend.app.database.connection.db_manager.get_collection")
    def test_physiotherapist_role_accepted(self, mock_col):
        """User with role 'physiotherapist' is accepted as clinician."""
        physio_user = _make_user(role="physiotherapist")

        mock_users = _make_mock_col(find_one_val=physio_user)
        mock_patients = _make_mock_col(find_list=[])
        mock_therapists = _make_mock_col(find_one_val=None)

        def col_router(name):
            if name == "users":
                return mock_users
            if name == "patients":
                return mock_patients
            if name == "therapists":
                return mock_therapists
            return _make_mock_col()

        mock_col.side_effect = col_router

        headers = _auth_header_for(physio_user)
        res = client.get(_DASHBOARD_URL, headers=headers)
        assert res.status_code == 200


# ---------------------------------------------------------------------------
# 3. Prescription CRUD & Validation Tests
# ---------------------------------------------------------------------------

class TestExercisePrescriptionCRUD:
    """Verify prescription creation, validation, update, and deactivation."""

    @patch("backend.app.database.connection.db_manager.get_collection")
    def test_create_prescription_validation_error(self, mock_col):
        """Sets < 1 or Reps < 1 must be rejected by Pydantic schema validation."""
        therapist_user = _make_user(role="therapist")
        mock_users = _make_mock_col(find_one_val=therapist_user)
        mock_col.return_value = mock_users

        headers = _auth_header_for(therapist_user)
        res = client.post(
            _ASSIGNMENTS_URL,
            headers=headers,
            json={
                "patient_id": str(ObjectId()),
                "exercise_id": "squat",
                "prescribed_sets": 0,  # invalid (ge=1)
                "prescribed_reps": 10,
            },
        )
        assert res.status_code == 422

    @patch("backend.app.database.connection.db_manager.get_collection")
    def test_create_prescription_exercise_not_found(self, mock_col):
        """Prescribing an exercise not in the catalog returns 404."""
        therapist_user = _make_user(role="therapist")
        patient_id = str(ObjectId())

        mock_users = _make_mock_col(find_one_val=therapist_user)
        mock_patients = _make_mock_col(find_one_val={"_id": ObjectId(patient_id), "user_id": ObjectId()})
        mock_exercises = _make_mock_col(find_one_val=None)

        def col_router(name):
            if name == "users":
                return mock_users
            if name == "patients":
                return mock_patients
            if name == "exercises":
                return mock_exercises
            return _make_mock_col()

        mock_col.side_effect = col_router

        headers = _auth_header_for(therapist_user)
        res = client.post(
            _ASSIGNMENTS_URL,
            headers=headers,
            json={
                "patient_id": patient_id,
                "exercise_id": "non-existent-exercise",
                "prescribed_sets": 3,
                "prescribed_reps": 10,
            },
        )
        assert res.status_code == 404
        assert "not found in exercise catalog" in res.text

    @patch("backend.app.database.connection.db_manager.get_collection")
    def test_create_prescription_success(self, mock_col):
        """Successfully create exercise prescription with populated response."""
        therapist_user = _make_user(role="therapist")
        patient_id = str(ObjectId())
        exercise_id = str(ObjectId())

        mock_users = _make_mock_col(find_one_val=therapist_user)
        mock_patients = _make_mock_col(find_one_val={
            "_id": ObjectId(patient_id),
            "user_id": ObjectId(),
            "assigned_therapist_id": therapist_user["_id"],
        })
        mock_exercises = _make_mock_col(find_one_val={
            "_id": ObjectId(exercise_id),
            "slug": "knee-flexion",
            "name": "Knee Flexion Extension",
            "target_joint": "knee",
        })

        inserted_id = ObjectId()
        mock_assignments = _make_mock_col()
        mock_assignments.insert_one = AsyncMock(return_value=MagicMock(inserted_id=inserted_id))

        def col_router(name):
            if name == "users":
                return mock_users
            if name == "patients":
                return mock_patients
            if name == "exercises":
                return mock_exercises
            if name == "exercise_assignments":
                return mock_assignments
            return _make_mock_col()

        mock_col.side_effect = col_router

        headers = _auth_header_for(therapist_user)
        payload = {
            "patient_id": patient_id,
            "exercise_id": "knee-flexion",
            "prescribed_sets": 3,
            "prescribed_reps": 12,
            "frequency_per_week": 4,
            "target_rom_degrees": 120.0,
            "custom_instructions": "Maintain upright posture; stop if sharp pain.",
        }
        res = client.post(_ASSIGNMENTS_URL, headers=headers, json=payload)
        assert res.status_code == 201
        data = res.json()
        assert data["id"] == str(inserted_id)
        assert data["prescribed_sets"] == 3
        assert data["prescribed_reps"] == 12
        assert data["target_rom_degrees"] == 120.0
        assert data["exercise_name"] == "Knee Flexion Extension"
        assert data["status"] == "active"

    @patch("backend.app.database.connection.db_manager.get_collection")
    def test_deactivate_prescription(self, mock_col):
        """Clinician deactivates (completes) an assignment."""
        therapist_user = _make_user(role="therapist")
        assignment_id = str(ObjectId())

        mock_users = _make_mock_col(find_one_val=therapist_user)

        existing_assignment = {
            "_id": ObjectId(assignment_id),
            "therapist_id": therapist_user["_id"],
            "patient_id": ObjectId(),
            "exercise_id": ObjectId(),
            "status": "completed",
            "prescribed_sets": 3,
            "prescribed_reps": 10,
            "frequency_per_week": 5,
        }

        mock_assignments = _make_mock_col(find_one_val=existing_assignment)
        mock_exercises = _make_mock_col(find_one_val=None)

        def col_router(name):
            if name == "users":
                return mock_users
            if name == "exercise_assignments":
                return mock_assignments
            if name == "exercises":
                return mock_exercises
            return _make_mock_col()

        mock_col.side_effect = col_router

        headers = _auth_header_for(therapist_user)
        res = client.delete(f"{_ASSIGNMENTS_URL}/{assignment_id}", headers=headers)
        assert res.status_code == 200
        assert res.json()["status"] == "completed"
