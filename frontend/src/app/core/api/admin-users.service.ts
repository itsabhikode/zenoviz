import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ListUsersResponse,
  RoleAssignmentResponse,
  UserAdminSummary,
} from './models';

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/admin/users`;

  list(
    opts: { limit?: number; paginationToken?: string | null; emailPrefix?: string | null } = {},
  ): Observable<ListUsersResponse> {
    let params = new HttpParams();
    if (opts.limit) params = params.set('limit', String(opts.limit));
    if (opts.paginationToken) params = params.set('pagination_token', opts.paginationToken);
    if (opts.emailPrefix) params = params.set('email_prefix', opts.emailPrefix);
    return this.http.get<ListUsersResponse>(this.base, { params });
  }

  get(userId: string): Observable<UserAdminSummary> {
    return this.http.get<UserAdminSummary>(`${this.base}/${userId}`);
  }

  grantRole(userId: string, role: string): Observable<RoleAssignmentResponse> {
    return this.http.post<RoleAssignmentResponse>(`${this.base}/${userId}/roles`, { role });
  }

  revokeRole(userId: string, role: string): Observable<RoleAssignmentResponse> {
    return this.http.delete<RoleAssignmentResponse>(
      `${this.base}/${userId}/roles/${role}`,
    );
  }
}
