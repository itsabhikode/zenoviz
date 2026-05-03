import { apiClient } from './client'
import type { RoleMutationRequest, RoleAssignmentResponse, UserRolesResponse, RoleUsersResponse } from './models'

const BASE = '/admin/roles'

export async function grantRole(body: RoleMutationRequest): Promise<RoleAssignmentResponse> {
  const { data } = await apiClient.post<RoleAssignmentResponse>(`${BASE}/grant`, body)
  return data
}

export async function revokeRole(body: RoleMutationRequest): Promise<RoleAssignmentResponse> {
  const { data } = await apiClient.post<RoleAssignmentResponse>(`${BASE}/revoke`, body)
  return data
}

export async function rolesForUser(userId: string): Promise<UserRolesResponse> {
  const { data } = await apiClient.get<UserRolesResponse>(`${BASE}/users/${userId}`)
  return data
}

export async function membersOfRole(role: string): Promise<RoleUsersResponse> {
  const { data } = await apiClient.get<RoleUsersResponse>(BASE, { params: { role } })
  return data
}
