"""Tests for Settings and configuration loading."""

from backend.app.core.config import Settings, get_settings


def test_settings_defaults():
    """Test default settings initialization."""
    settings = get_settings()
    assert settings.PROJECT_NAME == "AI Rehabilitation Coach"
    assert settings.API_V1_STR == "/api/v1"
    assert "http://localhost:5173" in settings.BACKEND_CORS_ORIGINS


def test_cors_origin_parser():
    """Test CORS origin parsing from list and strings."""
    s = Settings(BACKEND_CORS_ORIGINS='["http://localhost:5173", "http://example.com"]')
    assert "http://localhost:5173" in s.BACKEND_CORS_ORIGINS
    assert "http://example.com" in s.BACKEND_CORS_ORIGINS
