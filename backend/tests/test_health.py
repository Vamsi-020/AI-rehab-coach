"""Tests for health check endpoints (Root & v1)."""


def test_root_health_check(client):
    """Test legacy root health check endpoint GET /api/health."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "AI Rehabilitation Coach backend is running" in data["message"]


def test_v1_health_check(client):
    """Test versioned health check endpoint GET /api/v1/health."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["message"] == "AI Rehabilitation Coach backend is running"
    assert "environment" in data
    assert "version" in data
