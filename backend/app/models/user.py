"""User entity model and role enumerations."""

from enum import Enum
from typing import Optional
from pydantic import Field
from backend.app.models.base import MongoBaseModel


class UserRole(str, Enum):
    """User account access roles."""

    PATIENT = "patient"
    PHYSIOTHERAPIST = "physiotherapist"
    THERAPIST = "therapist"
    ADMIN = "admin"


class UserStatus(str, Enum):
    """User account statuses."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    PENDING = "pending"


class UserModel(MongoBaseModel):
    """User collection model representing authenticated system users.

    Stores the bcrypt-hashed password — never the plain-text password.
    """

    email: str = Field(..., description="Unique user email address (lowercase, normalised)")
    full_name: str = Field(..., description="User's complete full name")
    name: Optional[str] = Field(default=None, description="User's name alias")
    hashed_password: str = Field(..., description="bcrypt-hashed password — never plain text")
    role: UserRole = Field(default=UserRole.PATIENT, description="System access role")
    status: UserStatus = Field(default=UserStatus.ACTIVE, description="Account status")
    is_active: bool = Field(default=True, description="Whether the account is enabled")
    avatar_url: Optional[str] = Field(default=None, description="Profile avatar image URL")

