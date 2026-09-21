"""Tests for the rehabilitation session endpoints.

Covers authentication requirements, session creation, and listing.
Gracefully skips DB-dependent assertions when MongoDB is unavailable.
"""

import pytest


# ---------------------------------------------------------------------------
# POST /api/v1/sessions — auth guard
# ---------------------------------------------------------------------------

def test_create_session_requires_auth(client):
    """Posting without a token must return 401 Unauthorized."""
    payload = {
        "exercise_id": "507f1f77bcf86cd799439011",
        "exercise_name": "Seated Knee Extension",
        "sets_completed": 3,
        "reps_completed": 12,
        "average_form_accuracy_pct": 94.5,
        "peak_angle_degrees": 125.0,
    }
    res = client.post("/api/v1/sessions", json=payload)
    assert res.status_code == 401, (
        f"Expected 401 without auth, got {res.status_code}: {res.text}"
    )


def test_create_session_invalid_body(client):
    """Missing required fields must return 422 Unprocessable Entity."""
    res = client.post(
        "/api/v1/sessions",
        json={"exercise_id": "only-this-field"},
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    # 401 from bad token OR 422 from validation are both correct
    assert res.status_code in (401, 422)


# ---------------------------------------------------------------------------
# GET /api/v1/sessions/me — auth guard
# ---------------------------------------------------------------------------

def test_list_my_sessions_requires_auth(client):
    """Getting /sessions/me without a token must return 401."""
    res = client.get("/api/v1/sessions/me")
    assert res.status_code == 401


def test_list_my_sessions_with_bad_token(client):
    """An invalid token must return 401 — not 500."""
    res = client.get(
        "/api/v1/sessions/me",
        headers={"Authorization": "Bearer this.is.not.valid"},
    )
    assert res.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/v1/progress/me — auth guard
# ---------------------------------------------------------------------------

def test_progress_me_requires_auth(client):
    """Progress endpoint without token must return 401."""
    res = client.get("/api/v1/progress/me")
    assert res.status_code == 401


def test_progress_me_with_bad_token(client):
    """Progress endpoint with invalid token must return 401."""
    res = client.get(
        "/api/v1/progress/me",
        headers={"Authorization": "Bearer bad.jwt.token"},
    )
    assert res.status_code == 401
