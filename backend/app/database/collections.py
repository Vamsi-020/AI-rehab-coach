"""MongoDB collection name constants and helpers."""

from typing import Final

# Collection Names
USERS_COLLECTION: Final[str] = "users"
PATIENTS_COLLECTION: Final[str] = "patients"
THERAPISTS_COLLECTION: Final[str] = "therapists"
EXERCISES_COLLECTION: Final[str] = "exercises"
EXERCISE_ASSIGNMENTS_COLLECTION: Final[str] = "exercise_assignments"
REHABILITATION_SESSIONS_COLLECTION: Final[str] = "rehabilitation_sessions"
PROGRESS_RECORDS_COLLECTION: Final[str] = "progress_records"
NOTIFICATIONS_COLLECTION: Final[str] = "notifications"

ALL_COLLECTIONS = [
    USERS_COLLECTION,
    PATIENTS_COLLECTION,
    THERAPISTS_COLLECTION,
    EXERCISES_COLLECTION,
    EXERCISE_ASSIGNMENTS_COLLECTION,
    REHABILITATION_SESSIONS_COLLECTION,
    PROGRESS_RECORDS_COLLECTION,
    NOTIFICATIONS_COLLECTION,
]


class Collections:
    """Namespace class providing attribute-style access to collection name constants.

    Allows both ``Collections.USERS`` and the module-level ``USERS_COLLECTION``
    to be used interchangeably.
    """

    USERS: str = USERS_COLLECTION
    PATIENTS: str = PATIENTS_COLLECTION
    THERAPISTS: str = "therapists"
    EXERCISES: str = EXERCISES_COLLECTION
    EXERCISE_ASSIGNMENTS: str = EXERCISE_ASSIGNMENTS_COLLECTION
    REHABILITATION_SESSIONS: str = REHABILITATION_SESSIONS_COLLECTION
    PROGRESS_RECORDS: str = PROGRESS_RECORDS_COLLECTION
    NOTIFICATIONS: str = NOTIFICATIONS_COLLECTION
