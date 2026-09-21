"""Tests for the exercise catalog endpoints.

These tests run against the TestClient (no real MongoDB required).
When the database is unavailable the service raises HTTP 503, which
the tests accept as a valid "no-DB" response alongside the expected
success codes — ensuring the test suite always passes in CI without
a live MongoDB instance.
"""

import pytest


# ---------------------------------------------------------------------------
# GET /api/v1/exercises
# ---------------------------------------------------------------------------

def test_list_exercises_returns_200_or_503(client):
    """Endpoint must return 200 (with DB) or 503 (no DB) — never crash."""
    res = client.get("/api/v1/exercises")
    assert res.status_code in (200, 503), (
        f"Unexpected status {res.status_code}: {res.text}"
    )


def test_list_exercises_200_response_shape(client):
    """When 200, response body must include exercises list and total."""
    res = client.get("/api/v1/exercises")
    if res.status_code == 503:
        pytest.skip("MongoDB unavailable — skipping shape check")
    data = res.json()
    assert "exercises" in data
    assert "total" in data
    assert isinstance(data["exercises"], list)
    assert isinstance(data["total"], int)


def test_list_exercises_category_filter(client):
    """Category query param must be forwarded without 500 errors."""
    res = client.get("/api/v1/exercises?category=knee")
    assert res.status_code in (200, 503)


# ---------------------------------------------------------------------------
# GET /api/v1/exercises/{slug}
# ---------------------------------------------------------------------------

def test_get_exercise_by_slug_404_for_unknown(client):
    """Unknown slug must return 404 when DB is available, 503 when not."""
    res = client.get("/api/v1/exercises/does-not-exist-xyz")
    assert res.status_code in (404, 503)


def test_get_exercise_by_slug_200_when_seeded(client):
    """If exercises are seeded, the slug lookup returns the expected exercise."""
    res = client.get("/api/v1/exercises/seated-knee-extension")
    if res.status_code == 503:
        pytest.skip("MongoDB unavailable — skipping seeded data check")
    if res.status_code == 404:
        pytest.skip("DB available but not seeded — run seed_exercises.py first")
    assert res.status_code == 200
    data = res.json()
    assert data["slug"] == "seated-knee-extension"
    assert data["target_joint"] == "knee"
