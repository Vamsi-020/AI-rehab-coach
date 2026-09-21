"""Phase 5 authentication tests.

These tests cover:
- Registration (success, duplicate email)
- Login (success, wrong password, unknown email)
- Token validation (bad token, expired token)
- Protected /me endpoint (valid token, missing token, invalid token)

The tests run against an in-process FastAPI TestClient and mock the MongoDB
collection layer so no live database is required.
"""

from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.app.core.security import create_access_token, hash_password, verify_password
from backend.app.factory import create_application

# ---------------------------------------------------------------------------
# App fixture
# ---------------------------------------------------------------------------

app = create_application()
client = TestClient(app, raise_server_exceptions=False)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_REGISTER_URL = "/api/v1/auth/register"
_LOGIN_URL = "/api/v1/auth/login"
_ME_URL = "/api/v1/auth/me"

_SAMPLE_USER = {
    "full_name": "Alice Rehab",
    "email": "alice@rehab.com",
    "password": "SecurePass123!",
}



def _make_db_user_doc(
    full_name: str = _SAMPLE_USER["full_name"],
    email: str = _SAMPLE_USER["email"],
    password: str = _SAMPLE_USER["password"],
) -> dict:
    """Build a fake MongoDB user document."""
    from datetime import datetime
    from bson import ObjectId

    return {
        "_id": ObjectId(),
        "full_name": full_name,
        "email": email,
        "hashed_password": hash_password(password),
        "role": "patient",
        "status": "active",
        "is_active": True,
        "avatar_url": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }


# ---------------------------------------------------------------------------
# Security unit tests (no HTTP, no DB)
# ---------------------------------------------------------------------------


class TestPasswordHashing:
    """Verify bcrypt password utilities."""

    def test_hash_is_not_plain_text(self):
        hashed = hash_password("MySecret99")
        assert hashed != "MySecret99"
        assert hashed.startswith("$2b$") or hashed.startswith("$2a$")

    def test_correct_password_verifies(self):
        hashed = hash_password("MySecret99")
        assert verify_password("MySecret99", hashed) is True

    def test_wrong_password_fails(self):
        hashed = hash_password("MySecret99")
        assert verify_password("WrongPassword", hashed) is False

    def test_different_hashes_for_same_password(self):
        """bcrypt uses random salt — two hashes of the same input must differ."""
        h1 = hash_password("SamePass")
        h2 = hash_password("SamePass")
        assert h1 != h2


class TestJWTTokens:
    """Verify JWT creation and decoding."""

    def test_token_contains_subject(self):
        from backend.app.core.security import decode_access_token

        token = create_access_token(subject="user123")
        payload = decode_access_token(token)
        assert payload["sub"] == "user123"

    def test_token_contains_extra_claims(self):
        from backend.app.core.security import decode_access_token

        token = create_access_token(subject="u1", extra_claims={"role": "patient"})
        payload = decode_access_token(token)
        assert payload["role"] == "patient"

    def test_expired_token_raises(self):
        from jose import JWTError
        from backend.app.core.security import decode_access_token

        expired = create_access_token(subject="u1", expires_delta=timedelta(seconds=-1))
        with pytest.raises(JWTError):
            decode_access_token(expired)

    def test_tampered_token_raises(self):
        from jose import JWTError
        from backend.app.core.security import decode_access_token

        token = create_access_token(subject="u1")
        tampered = token[:-5] + "XXXXX"
        with pytest.raises(JWTError):
            decode_access_token(tampered)


# ---------------------------------------------------------------------------
# Registration endpoint tests
# ---------------------------------------------------------------------------


class TestRegisterEndpoint:
    """POST /api/v1/auth/register"""

    def test_successful_registration(self):
        """New user registration returns 201 with safe user data."""
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value=None)  # no existing user
        mock_col.insert_one = AsyncMock(return_value=MagicMock(inserted_id="fake"))

        with patch(
            "backend.app.services.auth_service._require_collection",
            return_value=mock_col,
        ):
            resp = client.post(_REGISTER_URL, json=_SAMPLE_USER)

        assert resp.status_code == 201
        data = resp.json()
        assert data["user"]["email"] == _SAMPLE_USER["email"]
        assert data["user"]["full_name"] == _SAMPLE_USER["full_name"]
        assert data["user"]["role"] == "patient"
        # Password must NEVER appear in the response
        assert "password" not in str(data)
        assert "hashed_password" not in str(data)

    def test_duplicate_email_returns_409(self):
        """Re-using an existing email returns HTTP 409 Conflict."""
        existing_doc = _make_db_user_doc()
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value=existing_doc)

        with patch(
            "backend.app.services.auth_service._require_collection",
            return_value=mock_col,
        ):
            resp = client.post(_REGISTER_URL, json=_SAMPLE_USER)

        assert resp.status_code == 409

    def test_invalid_email_returns_422(self):
        """Malformed email is rejected by Pydantic before hitting the service."""
        resp = client.post(
            _REGISTER_URL,
            json={**_SAMPLE_USER, "email": "not-an-email"},
        )
        assert resp.status_code == 422

    def test_short_password_returns_422(self):
        """Passwords under 8 characters are rejected."""
        resp = client.post(
            _REGISTER_URL,
            json={**_SAMPLE_USER, "password": "short"},
        )
        assert resp.status_code == 422

    def test_response_never_contains_password_hash(self):
        """Ensure hashed_password is absent even on repeated inspection."""
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value=None)
        mock_col.insert_one = AsyncMock(return_value=MagicMock())

        with patch(
            "backend.app.services.auth_service._require_collection",
            return_value=mock_col,
        ):
            resp = client.post(_REGISTER_URL, json=_SAMPLE_USER)

        body = resp.text
        assert "hashed_password" not in body
        assert "$2b$" not in body  # bcrypt hash prefix

    def test_registration_with_physiotherapist_role(self):
        """Registering with physiotherapist role is accepted and returned."""
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value=None)
        mock_col.insert_one = AsyncMock(return_value=MagicMock(inserted_id="fake_pt"))

        with patch(
            "backend.app.services.auth_service._require_collection",
            return_value=mock_col,
        ):
            resp = client.post(
                _REGISTER_URL,
                json={
                    "name": "Dr. Sarah",
                    "email": "sarah.physio@rehab.com",
                    "password": "SecurePassword99!",
                    "role": "physiotherapist",
                },
            )

        assert resp.status_code == 201
        data = resp.json()
        assert data["user"]["role"] == "physiotherapist"
        assert data["user"]["name"] == "Dr. Sarah"
        assert data["user"]["full_name"] == "Dr. Sarah"



# ---------------------------------------------------------------------------
# Login endpoint tests
# ---------------------------------------------------------------------------


class TestLoginEndpoint:
    """POST /api/v1/auth/login"""

    def test_successful_login_returns_token(self):
        """Valid credentials return an access token and user info."""
        user_doc = _make_db_user_doc()
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value=user_doc)

        with patch(
            "backend.app.services.auth_service._require_collection",
            return_value=mock_col,
        ):
            resp = client.post(
                _LOGIN_URL,
                json={"email": _SAMPLE_USER["email"], "password": _SAMPLE_USER["password"]},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == _SAMPLE_USER["email"]
        # Passwords must never appear
        assert "hashed_password" not in str(data)

    def test_wrong_password_returns_401(self):
        """Incorrect password returns HTTP 401."""
        user_doc = _make_db_user_doc()
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value=user_doc)

        with patch(
            "backend.app.services.auth_service._require_collection",
            return_value=mock_col,
        ):
            resp = client.post(
                _LOGIN_URL,
                json={"email": _SAMPLE_USER["email"], "password": "WrongPass999"},
            )

        assert resp.status_code == 401

    def test_unknown_email_returns_401(self):
        """Non-existent email returns HTTP 401 (same as wrong password — no enumeration)."""
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value=None)

        with patch(
            "backend.app.services.auth_service._require_collection",
            return_value=mock_col,
        ):
            resp = client.post(
                _LOGIN_URL,
                json={"email": "ghost@nowhere.com", "password": "irrelevant"},
            )


        assert resp.status_code == 401

    def test_disabled_account_returns_403(self):
        """A deactivated account is rejected with HTTP 403."""
        user_doc = _make_db_user_doc()
        user_doc["is_active"] = False
        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value=user_doc)

        with patch(
            "backend.app.services.auth_service._require_collection",
            return_value=mock_col,
        ):
            resp = client.post(
                _LOGIN_URL,
                json={"email": _SAMPLE_USER["email"], "password": _SAMPLE_USER["password"]},
            )

        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Protected /me endpoint tests
# ---------------------------------------------------------------------------


class TestMeEndpoint:
    """GET /api/v1/auth/me"""

    def test_me_with_valid_token_returns_profile(self):
        """A valid Bearer token returns the user's profile."""
        user_doc = _make_db_user_doc()
        user_id = str(user_doc["_id"])
        token = create_access_token(subject=user_id)

        mock_col = MagicMock()
        mock_col.find_one = AsyncMock(return_value=user_doc)

        with patch(
            "backend.app.core.dependencies.db_manager.get_collection",
            return_value=mock_col,
        ):
            resp = client.get(_ME_URL, headers={"Authorization": f"Bearer {token}"})

        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == _SAMPLE_USER["email"]
        assert "hashed_password" not in str(data)

    def test_me_without_token_returns_401(self):
        """No Authorization header → HTTP 401."""
        resp = client.get(_ME_URL)
        assert resp.status_code == 401

    def test_me_with_invalid_token_returns_401(self):
        """A garbage token string → HTTP 401."""
        resp = client.get(_ME_URL, headers={"Authorization": "Bearer this.is.garbage"})
        assert resp.status_code == 401

    def test_me_with_expired_token_returns_401(self):
        """An expired JWT → HTTP 401."""
        expired_token = create_access_token(
            subject="someuser", expires_delta=timedelta(seconds=-10)
        )
        resp = client.get(_ME_URL, headers={"Authorization": f"Bearer {expired_token}"})
        assert resp.status_code == 401

    def test_me_with_tampered_token_returns_401(self):
        """A tampered JWT signature → HTTP 401."""
        token = create_access_token(subject="someuser")
        tampered = token[:-8] + "tampered"
        resp = client.get(_ME_URL, headers={"Authorization": f"Bearer {tampered}"})
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Health endpoint regression test
# ---------------------------------------------------------------------------


class TestHealthRegression:
    """Verify existing health endpoints are unaffected by Phase 5 changes."""

    def test_root_health_still_works(self):
        resp = client.get("/api/health")
        assert resp.status_code == 200

    def test_v1_health_still_works(self):
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200
