"""Application security middlewares for FastAPI.

Includes:
- SecurityHeadersMiddleware: Injects OWASP recommended HTTP security headers.
- RateLimiterMiddleware: Lightweight sliding-window in-memory rate limiting to protect
  against brute-force and credential stuffing attacks on authentication endpoints.
"""

import time
from collections import defaultdict
from typing import Dict, List, Tuple
from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from backend.app.core.config import settings
from backend.app.core.logging import logger


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Injects OWASP-recommended HTTP security headers into every outgoing response."""

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        # Prevent MIME-type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking by disallowing framing
        response.headers["X-Frame-Options"] = "DENY"

        # Legacy XSS protection for older browsers
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer policy: send full URL for same-origin, origin only for cross-origin HTTPS
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions policy: camera strictly restricted to self (required for pose detection)
        response.headers["Permissions-Policy"] = "camera=(self), microphone=(), geolocation=()"

        return response


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """In-memory sliding window rate limiter for brute-force protection.

    Differentiates between sensitive authentication endpoints and general API endpoints.
    Bypassed in automated test environments.
    """

    def __init__(
        self,
        app,
        auth_limit: int = 30,
        auth_window_seconds: int = 60,
        general_limit: int = 200,
        general_window_seconds: int = 60,
    ):
        super().__init__(app)
        self.auth_limit = auth_limit
        self.auth_window = auth_window_seconds
        self.general_limit = general_limit
        self.general_window = general_window_seconds
        # In-memory buckets: ip -> list of timestamps
        self._auth_buckets: Dict[str, List[float]] = defaultdict(list)
        self._general_buckets: Dict[str, List[float]] = defaultdict(list)

    def _get_client_ip(self, request: Request) -> str:
        """Safely extract the client IP address."""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client and request.client.host:
            return request.client.host
        return "127.0.0.1"

    def _is_rate_limited(self, ip: str, bucket: Dict[str, List[float]], limit: int, window: int) -> Tuple[bool, int]:
        """Check if request exceeds rate limit; purge old timestamps."""
        now = time.time()
        cutoff = now - window
        # Purge entries older than window
        timestamps = [ts for ts in bucket[ip] if ts > cutoff]
        bucket[ip] = timestamps

        if len(timestamps) >= limit:
            retry_after = int(window - (now - timestamps[0])) + 1
            return True, max(retry_after, 1)

        timestamps.append(now)
        return False, 0

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for automated tests, health checks, and OPTIONS preflight
        if (
            settings.ENVIRONMENT.lower() == "testing"
            or request.headers.get("user-agent", "").startswith("testclient")
            or request.method == "OPTIONS"
            or request.url.path in ("/api/health", "/api/v1/health")
        ):
            return await call_next(request)

        client_ip = self._get_client_ip(request)
        path = request.url.path

        # Sensitive endpoints (login & registration)
        is_auth_endpoint = path.startswith("/api/v1/auth/login") or path.startswith("/api/v1/auth/register")

        if is_auth_endpoint:
            limited, retry_after = self._is_rate_limited(
                client_ip, self._auth_buckets, self.auth_limit, self.auth_window
            )
            if limited:
                logger.warning(
                    f"Rate limit exceeded for client {client_ip} on auth endpoint {path}. "
                    f"Throttled for {retry_after}s."
                )
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "status_code": 429,
                        "message": "Too many authentication attempts. Please wait a minute and try again.",
                        "error_type": "rate_limit_exceeded",
                        "retry_after_seconds": retry_after,
                    },
                    headers={"Retry-After": str(retry_after)},
                )
        else:
            limited, retry_after = self._is_rate_limited(
                client_ip, self._general_buckets, self.general_limit, self.general_window
            )
            if limited:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "status_code": 429,
                        "message": "Rate limit exceeded. Please wait a moment and try again.",
                        "error_type": "rate_limit_exceeded",
                        "retry_after_seconds": retry_after,
                    },
                    headers={"Retry-After": str(retry_after)},
                )

        return await call_next(request)
