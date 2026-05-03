import { apiClient } from './client'
import type { ListUsersResponse, UserAdminSummary, RoleAssignmentResponse } from './models'

const BASE = '/admin/users'

export interface ListUsersOptions {
  limit?: number
  pagination_token?: string
  email_prefix?: string
}

export async function listUsers(opts?: ListUsersOptions): Promise<ListUsersResponse> {
  const { data } = await apiClient.get<ListUsersResponse>(BASE, { params: opts })
  return data
}

export async function getUser(userId: string): Promise<UserAdminSummary> {
  const { data } = await apiClient.get<UserAdminSummary>(`${BASE}/${userId}`)
  return data
}

export async function grantRole(userId: string, role: string): Promise<RoleAssignmentResponse> {
  const { data } = await apiClient.post<RoleAssignmentResponse>(`${BASE}/${userId}/roles`, { role })
  return data
}

export async function revokeRole(userId: string, role: string): Promise<RoleAssignmentResponse> {
  const { data } = await apiClient.delete<RoleAssignmentResponse>(`${BASE}/${userId}/roles/${role}`)
  return data
}
