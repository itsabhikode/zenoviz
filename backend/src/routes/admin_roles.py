from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.dependencies import get_current_user, get_role_service, require_admin
from src.domain.user import CurrentUser
from src.models.roles import (
    RoleAssignmentResponse,
    RoleMutationRequest,
    RoleUsersResponse,
    UserRolesResponse,
)
from src.services.role_service import RoleService

router = APIRouter(prefix="/admin/roles", tags=["admin-roles"])


@router.post("/grant", response_model=RoleAssignmentResponse, status_code=status.HTTP_200_OK)
async def grant_role(
    body: RoleMutationRequest,
    _: Annotated[None, Depends(require_admin)],
    svc: Annotated[RoleService, Depends(get_role_service)],
) -> RoleAssignmentResponse:
    try:
        target, created = await svc.grant(
            role=body.role, user_id=body.user_id, email=body.email
        )
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return RoleAssignmentResponse(user_id=target, role=body.role, changed=created)


@router.post("/revoke", response_model=RoleAssignmentResponse)
async def revoke_role(
    body: RoleMutationRequest,
    current: Annotated[CurrentUser, Depends(get_current_user)],
    _: Annotated[None, Depends(require_admin)],
    svc: Annotated[RoleService, Depends(get_role_service)],
) -> RoleAssignmentResponse:
    try:
        target, removed = await svc.revoke(
            role=body.role,
            actor_user_id=current.user_id,
            user_id=body.user_id,
            email=body.email,
        )
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return RoleAssignmentResponse(user_id=target, role=body.role, changed=removed)


@router.get("/users/{user_id}", response_model=UserRolesResponse)
async def list_user_roles(
    user_id: str,
    _: Annotated[None, Depends(require_admin)],
    svc: Annotated[RoleService, Depends(get_role_service)],
) -> UserRolesResponse:
    return UserRolesResponse(user_id=user_id, roles=await svc.list_user_roles(user_id))


@router.get("", response_model=RoleUsersResponse)
async def list_role_members(
    _: Annotated[None, Depends(require_admin)],
    svc: Annotated[RoleService, Depends(get_role_service)],
    role: str = Query(..., min_length=1, max_length=64),
) -> RoleUsersResponse:
    try:
        users = await svc.list_users_with_role(role)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return RoleUsersResponse(role=role, user_ids=users)
