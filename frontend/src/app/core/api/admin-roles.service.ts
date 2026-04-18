import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  RoleAssignmentResponse,
  RoleMutationRequest,
  RoleUsersResponse,
  UserRolesResponse,
} from './models';

@Injectable({ providedIn: 'root' })
export class AdminRolesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/admin/roles`;

  grant(body: RoleMutationRequest): Observable<RoleAssignmentResponse> {
    return this.http.post<RoleAssignmentResponse>(`${this.base}/grant`, body);
  }

  revoke(body: RoleMutationRequest): Observable<RoleAssignmentResponse> {
    return this.http.post<RoleAssignmentResponse>(`${this.base}/revoke`, body);
  }

  rolesFor(userId: string): Observable<UserRolesResponse> {
    return this.http.get<UserRolesResponse>(`${this.base}/users/${userId}`);
  }

  membersOf(role: string): Observable<RoleUsersResponse> {
    const params = new HttpParams().set('role', role);
    return this.http.get<RoleUsersResponse>(this.base, { params });
  }
}
