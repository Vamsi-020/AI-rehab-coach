"""Tests for security headers and rate limiting middlewares."""

from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend.app.core.middleware import RateLimiterMiddleware, SecurityHeadersMiddleware


def test_security_headers_present(client):
    """Verify that OWASP security headers are attached to responses."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.headers.get("x-content-type-options") == "nosniff"
    assert response.headers.get("x-frame-options") == "DENY"
    assert response.headers.get("x-xss-protection") == "1; mode=block"
    assert response.headers.get("referrer-policy") == "strict-origin-when-cross-origin"
    assert "camera=(self)" in response.headers.get("permissions-policy", "")


def test_rate_limiter_throttles_excessive_requests():
    """Verify that RateLimiterMiddleware limits requests beyond threshold."""
    test_app = FastAPI()
    test_app.add_middleware(
        RateLimiterMiddleware,
        auth_limit=3,
        auth_window_seconds=10,
        general_limit=5,
        general_window_seconds=10,
    )

    @test_app.post("/api/v1/auth/login")
    def dummy_login():
        return {"status": "ok"}

    tc = TestClient(test_app)

    # First 3 requests should succeed
    for _ in range(3):
        res = tc.post("/api/v1/auth/login", headers={"User-Agent": "RealBrowser/1.0"})
        assert res.status_code == 200

    # 4th request should be throttled (429 Too Many Requests)
    throttled_res = tc.post("/api/v1/auth/login", headers={"User-Agent": "RealBrowser/1.0"})
    assert throttled_res.status_code == 429
    assert throttled_res.json()["error_type"] == "rate_limit_exceeded"
    assert "retry_after_seconds" in throttled_res.json()
    assert throttled_res.headers.get("retry-after") is not None
