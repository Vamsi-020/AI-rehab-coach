"""Pytest fixtures for backend test suite."""

import pytest
from fastapi.testclient import TestClient
from backend.app.factory import create_application


@pytest.fixture(scope="session")
def app():
    """Create a FastAPI application instance for testing."""
    return create_application()


@pytest.fixture(scope="session")
def client(app):
    """Create a TestClient instance for issuing API requests."""
    with TestClient(app) as test_client:
        yield test_client
