"""Common generic response schemas."""

from typing import Any, Generic, Optional, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class StandardResponse(BaseModel, Generic[T]):
    """Standardized API response envelope."""

    status: str = "ok"
    message: str = "Success"
    data: Optional[T] = None


class ErrorDetail(BaseModel):
    """Structured error message representation."""

    status: str = "error"
    message: str
    status_code: int
    details: Optional[Any] = None
