"""FastAPI dependency for authenticating requests via Bearer JWT tokens.

Import ``get_current_active_user`` and use it as a FastAPI dependency on any
protected route.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError

from backend.app.core.security import decode_access_token
from backend.app.database.connection import db_manager
from backend.app.database.collections import Collections

# Tells FastAPI where clients obtain tokens (used by OpenAPI docs).
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Extract and verify the Bearer token; return the raw user document.

    Raises HTTP 401 for missing, invalid, or expired tokens.
    Raises HTTP 503 if the database is unavailable.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Fetch user from database
    collection = db_manager.get_collection(Collections.USERS)
    if collection is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is currently unavailable",
        )

    from bson import ObjectId

    if not ObjectId.is_valid(user_id):
        raise credentials_exception

    user_doc = await collection.find_one({"_id": ObjectId(user_id)})
    if user_doc is None:
        raise credentials_exception

    return user_doc


async def get_current_active_user(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Extend ``get_current_user`` by also asserting the account is active.

    Raises HTTP 403 if the account has been deactivated.
    """
    if not current_user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )
    return current_user
