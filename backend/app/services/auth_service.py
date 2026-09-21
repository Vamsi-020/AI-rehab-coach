"""Authentication service layer.

Encapsulates all business logic for registration, login, and user lookup.
Routes should call these functions rather than touching the database directly.
"""

from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError

from backend.app.core.logging import logger
from backend.app.core.security import create_access_token, hash_password, verify_password
from backend.app.database.collections import Collections
from backend.app.database.connection import db_manager
from backend.app.models.user import UserRole, UserStatus
from backend.app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _user_doc_to_response(doc: dict) -> UserResponse:
    """Convert a raw MongoDB user document to a safe :class:`UserResponse`.

    The ``hashed_password`` field is intentionally excluded.
    """
    full_name = doc.get("full_name") or doc.get("name") or ""
    return UserResponse(
        id=str(doc["_id"]),
        full_name=full_name,
        name=full_name,
        email=doc["email"],
        role=doc["role"],
        is_active=doc.get("is_active", True),
        status=doc.get("status", "active"),
        created_at=doc.get("created_at", datetime.utcnow()),
        updated_at=doc.get("updated_at"),
    )


def _require_collection():
    """Return the users collection or raise HTTP 503."""
    collection = db_manager.get_collection(Collections.USERS)
    if collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is currently unavailable. Please try again later.",
        )
    return collection


# ---------------------------------------------------------------------------
# Service functions
# ---------------------------------------------------------------------------

async def register_user(payload: RegisterRequest) -> UserResponse:
    """Register a new user.

    Steps:
    1. Check that the email is not already registered.
    2. Hash the password with bcrypt (never stored as plain text).
    3. Persist the user document to MongoDB.
    4. Return :class:`UserResponse` (hashed_password is excluded).

    Raises:
        HTTP 409  — email already taken.
        HTTP 503  — database unavailable.
    """
    collection = _require_collection()

    # 1. Duplicate check
    existing = await collection.find_one({"email": payload.email})
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email address already exists.",
        )

    # 2. Hash password — plain text is discarded immediately after hashing
    password_hash = hash_password(payload.password)

    # 3. Build the document
    now = datetime.utcnow()
    user_doc = {
        "_id": ObjectId(),
        "email": payload.email,
        "full_name": payload.full_name,
        "name": payload.full_name,
        "hashed_password": password_hash,   # bcrypt hash only
        "role": payload.role.value if payload.role else UserRole.PATIENT.value,
        "status": UserStatus.ACTIVE.value,
        "is_active": True,
        "avatar_url": None,
        "created_at": now,
        "updated_at": now,
    }


    try:
        await collection.insert_one(user_doc)
        logger.info(f"New user registered: id={user_doc['_id']}, role={user_doc['role']}")
    except DuplicateKeyError:
        # Handles a race condition where two identical registrations arrive simultaneously
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email address already exists.",
        )

    return _user_doc_to_response(user_doc)


async def login_user(payload: LoginRequest) -> TokenResponse:
    """Authenticate a user and return a JWT access token.

    Steps:
    1. Fetch the user document by email.
    2. Verify the password with bcrypt (constant-time comparison).
    3. Check the account is active.
    4. Issue a signed JWT carrying the user ID and role.
    5. Return :class:`TokenResponse` — password hash is never included.

    Raises:
        HTTP 401  — invalid credentials (deliberately vague).
        HTTP 403  — account is disabled.
        HTTP 503  — database unavailable.
    """
    collection = _require_collection()

    # Generic error to avoid leaking account existence
    invalid_credentials = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 1. Look up user
    user_doc = await collection.find_one({"email": payload.email})
    if user_doc is None:
        raise invalid_credentials

    # 2. Verify password — bcrypt constant-time check
    if not verify_password(payload.password, user_doc["hashed_password"]):
        raise invalid_credentials

    # 3. Account status check
    if not user_doc.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )

    # 4. Issue JWT
    user_id = str(user_doc["_id"])
    token = create_access_token(
        subject=user_id,
        extra_claims={"role": user_doc["role"], "email": user_doc["email"]},
    )

    logger.info(f"User logged in: id={user_id}, role={user_doc['role']}")

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=_user_doc_to_response(user_doc),
    )


async def get_user_by_id(user_id: str) -> Optional[dict]:
    """Return the raw MongoDB document for *user_id*, or None if not found."""
    collection = _require_collection()
    if not ObjectId.is_valid(user_id):
        return None
    return await collection.find_one({"_id": ObjectId(user_id)})
