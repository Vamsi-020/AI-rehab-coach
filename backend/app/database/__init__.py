"""Database connection and collection management package."""

from backend.app.database.collections import (
    ALL_COLLECTIONS,
    EXERCISE_ASSIGNMENTS_COLLECTION,
    EXERCISES_COLLECTION,
    NOTIFICATIONS_COLLECTION,
    PATIENTS_COLLECTION,
    PROGRESS_RECORDS_COLLECTION,
    REHABILITATION_SESSIONS_COLLECTION,
    THERAPISTS_COLLECTION,
    USERS_COLLECTION,
)
from backend.app.database.connection import MongoDBManager, db_manager
from backend.app.database.indexes import INDEX_DEFINITIONS, init_indexes

__all__ = [
    "db_manager",
    "MongoDBManager",
    "init_indexes",
    "INDEX_DEFINITIONS",
    "ALL_COLLECTIONS",
    "USERS_COLLECTION",
    "PATIENTS_COLLECTION",
    "THERAPISTS_COLLECTION",
    "EXERCISES_COLLECTION",
    "EXERCISE_ASSIGNMENTS_COLLECTION",
    "REHABILITATION_SESSIONS_COLLECTION",
    "PROGRESS_RECORDS_COLLECTION",
    "NOTIFICATIONS_COLLECTION",
]

