"""Authentication API endpoints.

Routes:
    POST /auth/register  — Create a new user account.
    POST /auth/login     — Exchange credentials for a JWT.
    GET  /auth/me        — Return the authenticated user's profile.
"""

from fastapi import APIRouter, Depends, status

from backend.app.core.dependencies import get_current_active_user
from backend.app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UserResponse,
)
from backend.app.services.auth_service import login_user, register_user, _user_doc_to_response

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
async def register(payload: RegisterRequest) -> RegisterResponse:
    """Register a new user.

    - Validates email format and password length.
    - Rejects duplicate email addresses.
    - Stores only the bcrypt hash of the password.
    - Returns a safe user representation (no password fields).
    """
    user = await register_user(payload)
    return RegisterResponse(message="Registration successful", user=user)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Login and receive a JWT access token",
)
async def login(payload: LoginRequest) -> TokenResponse:
    """Authenticate with email and password.

    - Verifies credentials using bcrypt constant-time comparison.
    - Returns a signed JWT access token and basic user information.
    - Never returns the password or its hash.
    """
    return await login_user(payload)


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get the currently authenticated user's profile",
)
async def me(current_user: dict = Depends(get_current_active_user)) -> UserResponse:
    """Protected endpoint — requires a valid Bearer token.

    - Returns the authenticated user's public profile.
    - Rejects requests with missing, invalid, or expired tokens (HTTP 401).
    - Rejects deactivated accounts (HTTP 403).
    - Never exposes the password hash.
    """
    return _user_doc_to_response(current_user)
