from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.dependencies import (
    get_current_user,
    get_role_service,
    get_user_admin_service,
    require_admin,
)
from src.domain.user import CurrentUser
from src.models.roles import RoleAssignmentResponse
from src.models.users import AssignRoleBody, ListUsersResponse, UserAdminSummary
from src.services.role_service import RoleService
from src.services.user_admin_service import UserAdminService, UserWithRoles

router = APIRouter(prefix="/admin/users", tags=["admin-users"])


def _to_summary(entry: UserWithRoles) -> UserAdminSummary:
    u = entry.user
    return UserAdminSummary(
        user_id=u.user_id,
        username=u.username,
        email=u.email,
        email_verified=u.email_verified,
        given_name=u.given_name,
        family_name=u.family_name,
        phone_number=u.phone_number,
        status=u.status,
        enabled=u.enabled,
        created_at=u.created_at,
        roles=entry.roles,
    )


@router.get("", response_model=ListUsersResponse)
async def list_users(
    _: Annotated[None, Depends(require_admin)],
    svc: Annotated[UserAdminService, Depends(get_user_admin_service)],
    limit: int = Query(50, ge=1, le=60),
    pagination_token: str | None = Query(None),
    email_prefix: str | None = Query(
        None,
        description='Prefix filter on email, maps to Cognito `email ^= "..."`.',
    ),
) -> ListUsersResponse:
    page = await svc.list_users(
        limit=limit,
        pagination_token=pagination_token,
        email_prefix=email_prefix,
    )
    return ListUsersResponse(
        users=[_to_summary(u) for u in page.users],
        next_pagination_token=page.next_pagination_token,
    )


@router.get("/{user_id}", response_model=UserAdminSummary)
async def get_user(
    user_id: str,
    _: Annotated[None, Depends(require_admin)],
    svc: Annotated[UserAdminService, Depends(get_user_admin_service)],
) -> UserAdminSummary:
    entry = await svc.get_user(user_id)
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} not found in Cognito",
        )
    return _to_summary(entry)


@router.post(
    "/{user_id}/roles",
    response_model=RoleAssignmentResponse,
    status_code=status.HTTP_200_OK,
)
async def grant_role_to_user(
    user_id: str,
    body: AssignRoleBody,
    _: Annotated[None, Depends(require_admin)],
    role_svc: Annotated[RoleService, Depends(get_role_service)],
) -> RoleAssignmentResponse:
    try:
        target, created = await role_svc.grant(role=body.role, user_id=user_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return RoleAssignmentResponse(user_id=target, role=body.role, changed=created)


@router.delete("/{user_id}/roles/{role}", response_model=RoleAssignmentResponse)
async def revoke_role_from_user(
    user_id: str,
    role: str,
    current: Annotated[CurrentUser, Depends(get_current_user)],
    _: Annotated[None, Depends(require_admin)],
    role_svc: Annotated[RoleService, Depends(get_role_service)],
) -> RoleAssignmentResponse:
    try:
        target, removed = await role_svc.revoke(
            role=role, actor_user_id=current.user_id, user_id=user_id
        )
    except PermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return RoleAssignmentResponse(user_id=target, role=role, changed=removed)
