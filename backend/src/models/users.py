from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class UserAdminSummary(BaseModel):
    user_id: str
    username: str
    email: str | None
    email_verified: bool
    given_name: str | None
    family_name: str | None
    phone_number: str | None
    status: str
    enabled: bool
    created_at: datetime | None
    roles: list[str]


class ListUsersResponse(BaseModel):
    users: list[UserAdminSummary]
    next_pagination_token: str | None = None


class AssignRoleBody(BaseModel):
    role: str = Field(..., min_length=1, max_length=64, examples=["admin"])
