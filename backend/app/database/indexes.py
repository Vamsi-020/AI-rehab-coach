"""MongoDB collection index definitions and initialization."""

from typing import Dict, List
import motor.motor_asyncio
from pymongo import ASCENDING, DESCENDING, IndexModel
from backend.app.core.logging import logger
from backend.app.database.collections import Collections


INDEX_DEFINITIONS: Dict[str, List[IndexModel]] = {
    Collections.USERS: [
        IndexModel([("email", ASCENDING)], unique=True, name="idx_users_email_unique"),
        IndexModel([("role", ASCENDING)], name="idx_users_role"),
    ],
    Collections.PATIENTS: [
        IndexModel([("user_id", ASCENDING)], unique=True, name="idx_patients_user_id_unique"),
        IndexModel([("assigned_therapist_id", ASCENDING)], name="idx_patients_therapist_id"),
    ],
    Collections.THERAPISTS: [
        IndexModel([("user_id", ASCENDING)], unique=True, name="idx_therapists_user_id_unique"),
        IndexModel([("clinic_organization", ASCENDING)], name="idx_therapists_clinic"),
    ],
    Collections.EXERCISES: [
        IndexModel([("slug", ASCENDING)], unique=True, name="idx_exercises_slug_unique"),
        IndexModel([("target_joint", ASCENDING)], name="idx_exercises_target_joint"),
        IndexModel([("category_key", ASCENDING)], name="idx_exercises_category_key"),
    ],
    Collections.EXERCISE_ASSIGNMENTS: [
        IndexModel([("patient_id", ASCENDING)], name="idx_assignments_patient_id"),
        IndexModel([("therapist_id", ASCENDING)], name="idx_assignments_therapist_id"),
        IndexModel(
            [("patient_id", ASCENDING), ("status", ASCENDING)],
            name="idx_assignments_patient_status",
        ),
    ],
    Collections.REHABILITATION_SESSIONS: [
        IndexModel([("patient_id", ASCENDING)], name="idx_sessions_patient_id"),
        IndexModel(
            [("patient_id", ASCENDING), ("created_at", DESCENDING)],
            name="idx_sessions_patient_created_at",
        ),
    ],
    Collections.PROGRESS_RECORDS: [
        IndexModel([("patient_id", ASCENDING)], name="idx_progress_patient_id"),
        IndexModel(
            [("patient_id", ASCENDING), ("record_date", DESCENDING)],
            name="idx_progress_patient_date",
        ),
    ],
    Collections.NOTIFICATIONS: [
        IndexModel(
            [("recipient_user_id", ASCENDING), ("is_read", ASCENDING)],
            name="idx_notifications_recipient_read",
        ),
        IndexModel(
            [("recipient_user_id", ASCENDING), ("created_at", DESCENDING)],
            name="idx_notifications_recipient_created",
        ),
    ],
}


async def init_indexes(db: motor.motor_asyncio.AsyncIOMotorDatabase) -> Dict[str, List[str]]:
    """Initialize performance and uniqueness indexes across all core collections.

    Safely handles cases where the database or collection is not available.
    """
    created: Dict[str, List[str]] = {}
    if db is None:
        return created

    for collection_name, index_models in INDEX_DEFINITIONS.items():
        try:
            col = db[collection_name]
            result = await col.create_indexes(index_models)
            created[collection_name] = result
            logger.info(f"Initialized indexes for '{collection_name}': {result}")
        except Exception as exc:
            logger.warning(f"Index creation skipped/failed for '{collection_name}': {str(exc)}")
            created[collection_name] = []

    return created
