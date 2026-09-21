"""Pydantic request/response schemas for authentication endpoints.

These are deliberately kept separate from the database models so that:
- Request payloads can be validated without touching the DB layer.
- Responses never include hashed_password or other sensitive fields.
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from backend.app.models.user import UserRole


# ---------------------------------------------------------------------------
# Request schemas (inbound)
# ---------------------------------------------------------------------------


class RegisterRequest(BaseModel):
    """Body schema for POST /api/v1/auth/register."""

    full_name: str = Field(..., min_length=2, max_length=100, description="User's full name")
    name: Optional[str] = Field(default=None, min_length=2, max_length=100, description="Optional alias for full_name")
    email: EmailStr = Field(..., description="Valid email address")
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Password (min 8 characters)",
    )
    role: Optional[UserRole] = Field(
        default=UserRole.PATIENT,
        description="Requested role — defaults to 'patient'",
    )

    @model_validator(mode="before")
    @classmethod
    def sync_name_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            name_val = data.get("full_name") or data.get("name")
            if name_val:
                data["full_name"] = name_val
                data["name"] = name_val
        return data

    @field_validator("email", mode="before")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        """Lowercase and strip whitespace from the email before validation."""
        return v.strip().lower()

    @field_validator("full_name", mode="before")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class LoginRequest(BaseModel):
    """Body schema for POST /api/v1/auth/login."""

    email: EmailStr = Field(..., description="Registered email address")
    password: str = Field(..., description="Account password")

    @field_validator("email", mode="before")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return v.strip().lower()


# ---------------------------------------------------------------------------
# Response schemas (outbound) — hashed_password is NEVER included
# ---------------------------------------------------------------------------


class UserResponse(BaseModel):
    """Safe public representation of a user — no sensitive fields."""

    id: str = Field(..., description="User's unique identifier")
    full_name: str
    name: str
    email: str
    role: UserRole
    is_active: bool
    status: str = "active"
    created_at: datetime
    updated_at: Optional[datetime] = None

    @model_validator(mode="before")
    @classmethod
    def sync_name_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            name_val = data.get("full_name") or data.get("name") or ""
            data["full_name"] = name_val
            data["name"] = name_val
        return data

    model_config = {"from_attributes": True}



class TokenResponse(BaseModel):
    """Response returned after a successful login."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class RegisterResponse(BaseModel):
    """Response returned after a successful registration."""

    message: str = "Registration successful"
    user: UserResponse
