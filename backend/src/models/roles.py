from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field, model_validator


class RoleMutationRequest(BaseModel):
    user_id: str | None = Field(
        default=None,
        description="Cognito sub of the target user. Provide this OR email.",
    )
    email: EmailStr | None = Field(
        default=None,
        description="Email of the target user; resolved to sub via Cognito.",
    )
    role: str = Field(..., min_length=1, max_length=64, examples=["admin"])

    @model_validator(mode="after")
    def _exactly_one_target(self) -> "RoleMutationRequest":
        if (self.user_id is None) == (self.email is None):
            raise ValueError("Provide exactly one of user_id or email")
        return self


class RoleAssignmentResponse(BaseModel):
    user_id: str
    role: str
    changed: bool = Field(
        description="True if DB state actually changed; False if it was already in that state.",
    )


class UserRolesResponse(BaseModel):
    user_id: str
    roles: list[str]


class RoleUsersResponse(BaseModel):
    role: str
    user_ids: list[str]
