"""Unit and integration tests for database models, schemas, and connection manager."""

import pytest
from bson import ObjectId
from backend.app.database.collections import (
    ALL_COLLECTIONS,
    USERS_COLLECTION,
    PATIENTS_COLLECTION,
    THERAPISTS_COLLECTION,
    EXERCISES_COLLECTION,
    EXERCISE_ASSIGNMENTS_COLLECTION,
    REHABILITATION_SESSIONS_COLLECTION,
    PROGRESS_RECORDS_COLLECTION,
    NOTIFICATIONS_COLLECTION,
)
from backend.app.database.connection import MongoDBManager
from backend.app.models import (
    AffectedSide,
    AssignmentStatus,
    DifficultyLevel,
    ExerciseAssignmentModel,
    ExerciseModel,
    NotificationModel,
    NotificationType,
    PatientModel,
    ProgressRecordModel,
    RehabilitationSessionModel,
    TargetJoint,
    TherapistModel,
    UserModel,
    UserRole,
    UserStatus,
)


def test_collection_constants():
    """Verify all 8 expected database collection names are defined."""
    assert len(ALL_COLLECTIONS) == 8
    assert USERS_COLLECTION == "users"
    assert PATIENTS_COLLECTION == "patients"
    assert THERAPISTS_COLLECTION == "therapists"
    assert EXERCISES_COLLECTION == "exercises"
    assert EXERCISE_ASSIGNMENTS_COLLECTION == "exercise_assignments"
    assert REHABILITATION_SESSIONS_COLLECTION == "rehabilitation_sessions"
    assert PROGRESS_RECORDS_COLLECTION == "progress_records"
    assert NOTIFICATIONS_COLLECTION == "notifications"


def test_user_model_serialization():
    """Test UserModel instantiation and JSON serialization."""
    user = UserModel(
        email="patient.alex@example.com",
        full_name="Alex Parker",
        hashed_password="$2b$12$fakepasswordhash",
        role=UserRole.PATIENT,
        status=UserStatus.ACTIVE,
    )
    assert user.email == "patient.alex@example.com"
    assert user.role == UserRole.PATIENT
    data = user.model_dump(by_alias=True)
    assert data["email"] == "patient.alex@example.com"
    assert data["hashed_password"] == "$2b$12$fakepasswordhash"



def test_patient_model_serialization():
    """Test PatientModel instantiation with foreign keys and enums."""
    user_oid = ObjectId()
    therapist_oid = ObjectId()
    patient = PatientModel(
        user_id=user_oid,
        assigned_therapist_id=therapist_oid,
        injury_condition="ACL Reconstruction",
        affected_side=AffectedSide.RIGHT,
        baseline_rom_degrees=95.0,
        target_rom_degrees=135.0,
    )
    assert patient.injury_condition == "ACL Reconstruction"
    assert patient.affected_side == AffectedSide.RIGHT
    data = patient.model_dump(by_alias=True)
    assert str(data["user_id"]) == str(user_oid)


def test_exercise_model_serialization():
    """Test ExerciseModel definition and thresholds."""
    exercise = ExerciseModel(
        slug="seated-knee-extension",
        name="Seated Knee Extension",
        category="Knee Rehab",
        description="Strengthens quadriceps in terminal extension",
        target_joint=TargetJoint.KNEE,
        difficulty=DifficultyLevel.GENTLE,
        target_angle_min=90.0,
        target_angle_max=175.0,
        default_sets=3,
        default_reps=12,
    )
    assert exercise.slug == "seated-knee-extension"
    assert exercise.target_angle_max == 175.0


def test_session_and_progress_models():
    """Test RehabilitationSessionModel and ProgressRecordModel."""
    patient_oid = ObjectId()
    exercise_oid = ObjectId()

    session = RehabilitationSessionModel(
        patient_id=patient_oid,
        exercise_id=exercise_oid,
        sets_completed=3,
        reps_completed=12,
        average_form_accuracy_pct=94.5,
    )
    assert session.reps_completed == 12
    assert session.average_form_accuracy_pct == 94.5

    progress = ProgressRecordModel(
        patient_id=patient_oid,
        overall_recovery_score=82.0,
        weekly_adherence_pct=90.0,
        active_streak_days=6,
    )
    assert progress.overall_recovery_score == 82.0
    assert progress.active_streak_days == 6


@pytest.mark.anyio
async def test_db_manager_health_fallback():
    """Verify DB manager reports clean disconnected status without crashing."""
    manager = MongoDBManager()
    health = await manager.check_health()
    assert health["status"] == "disconnected"
    assert "ai_rehab_coach" in health["database"]


def test_health_endpoints_with_db(client):
    """Test GET /api/v1/health and GET /api/v1/health/db."""
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert "database" in data
    assert "status" in data["database"]

    res_db = client.get("/api/v1/health/db")
    assert res_db.status_code == 200
    db_data = res_db.json()
    assert "status" in db_data
    assert db_data["database"] == "ai_rehab_coach"


def test_therapist_and_assignment_and_notification_models():
    """Verify TherapistModel, ExerciseAssignmentModel, and NotificationModel serialization."""
    u_oid = ObjectId()
    therapist = TherapistModel(
        user_id=u_oid,
        license_number="PT-12345",
        clinic_organization="Motion Clinic",
    )
    assert therapist.license_number == "PT-12345"
    assert therapist.is_accepting_patients is True

    assignment = ExerciseAssignmentModel(
        patient_id=ObjectId(),
        therapist_id=ObjectId(),
        exercise_id=ObjectId(),
        prescribed_sets=3,
        prescribed_reps=10,
        status=AssignmentStatus.ACTIVE,
    )
    assert assignment.prescribed_sets == 3
    assert assignment.status == AssignmentStatus.ACTIVE

    notification = NotificationModel(
        recipient_user_id=u_oid,
        type=NotificationType.ROUTINE_REMINDER,
        title="Workout reminder",
        message="Time for your knee rehab routine!",
    )
    assert notification.is_read is False
    assert notification.type == NotificationType.ROUTINE_REMINDER


def test_index_definitions():
    """Verify performance and unique indexes are defined for all core collections."""
    from backend.app.database.indexes import INDEX_DEFINITIONS
    from backend.app.database.collections import Collections

    assert Collections.USERS in INDEX_DEFINITIONS
    assert Collections.PATIENTS in INDEX_DEFINITIONS
    assert Collections.THERAPISTS in INDEX_DEFINITIONS
    assert Collections.EXERCISES in INDEX_DEFINITIONS
    assert Collections.EXERCISE_ASSIGNMENTS in INDEX_DEFINITIONS
    assert Collections.REHABILITATION_SESSIONS in INDEX_DEFINITIONS
    assert Collections.PROGRESS_RECORDS in INDEX_DEFINITIONS
    assert Collections.NOTIFICATIONS in INDEX_DEFINITIONS

    # Users email index must be unique
    user_indexes = INDEX_DEFINITIONS[Collections.USERS]
    email_idx = next(idx for idx in user_indexes if idx.document.get("name") == "idx_users_email_unique")
    assert email_idx.document.get("unique") is True

    # Exercise slug must be unique
    exercise_indexes = INDEX_DEFINITIONS[Collections.EXERCISES]
    slug_idx = next(idx for idx in exercise_indexes if idx.document.get("name") == "idx_exercises_slug_unique")
    assert slug_idx.document.get("unique") is True


@pytest.mark.anyio
async def test_init_indexes_none_db():
    """init_indexes should return empty dict when db is None."""
    from backend.app.database.indexes import init_indexes
    res = await init_indexes(None)
    assert res == {}

