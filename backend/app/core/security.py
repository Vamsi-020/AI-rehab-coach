"""Security utilities: password hashing and JWT token handling.

All secrets are loaded exclusively from environment configuration.
Plain-text passwords are NEVER stored or logged.
"""

from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import bcrypt
from jose import JWTError, jwt

from backend.app.core.config import settings

# ---------------------------------------------------------------------------
# Password hashing (native bcrypt)
# ---------------------------------------------------------------------------

def hash_password(plain_password: str) -> str:
    """Return the bcrypt hash of *plain_password*.

    The returned hash is safe to store in the database.
    The original plain-text password is never retained.
    """
    pwd_bytes = plain_password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return True if *plain_password* matches the stored *hashed_password*."""
    try:
        pwd_bytes = plain_password.encode("utf-8")[:72]
        return bcrypt.checkpw(pwd_bytes, hashed_password.encode("utf-8"))
    except Exception:
        return False



# ---------------------------------------------------------------------------
# JWT tokens
# ---------------------------------------------------------------------------

ALGORITHM = "HS256"


def create_access_token(
    subject: str,
    extra_claims: Optional[Dict[str, Any]] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a signed JWT access token.

    Args:
        subject: Typically the user's string-formatted ObjectId.
        extra_claims: Additional payload claims (e.g. role, email).
        expires_delta: Custom TTL; falls back to ``settings.ACCESS_TOKEN_EXPIRE_MINUTES``.

    Returns:
        A compact, URL-safe JWT string.
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    expire = datetime.utcnow() + expires_delta
    payload: Dict[str, Any] = {
        "sub": subject,
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT access token.

    Raises:
        jose.JWTError: If the token is invalid, expired, or has a bad signature.
    """
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[ALGORITHM])
