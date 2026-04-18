import { Routes } from '@angular/router';

import { adminGuard, authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register.component').then((m) => m.RegisterComponent),
  },

  {
    path: 'app',
    loadComponent: () =>
      import('./core/layout/user-shell.component').then((m) => m.UserShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'my-bookings' },
      {
        path: 'my-bookings',
        loadComponent: () =>
          import('./features/bookings/my-bookings.component').then(
            (m) => m.MyBookingsComponent,
          ),
      },
      {
        path: 'book',
        loadComponent: () =>
          import('./features/bookings/create-booking.component').then(
            (m) => m.CreateBookingComponent,
          ),
      },
      {
        path: 'bookings/:id/edit',
        loadComponent: () =>
          import('./features/bookings/edit-booking.component').then(
            (m) => m.EditBookingComponent,
          ),
      },
    ],
  },

  {
    path: 'admin',
    loadComponent: () =>
      import('./core/layout/admin-shell.component').then((m) => m.AdminShellComponent),
    canActivate: [authGuard, adminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'users' },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/admin/admin-users.component').then(
            (m) => m.AdminUsersComponent,
          ),
      },
      {
        path: 'roles',
        loadComponent: () =>
          import('./features/admin/admin-roles.component').then(
            (m) => m.AdminRolesComponent,
          ),
      },
      {
        path: 'pricing',
        loadComponent: () =>
          import('./features/admin/admin-pricing.component').then(
            (m) => m.AdminPricingComponent,
          ),
      },
      {
        path: 'bookings',
        loadComponent: () =>
          import('./features/admin/admin-bookings.component').then(
            (m) => m.AdminBookingsComponent,
          ),
      },
      {
        path: 'payments',
        loadComponent: () =>
          import('./features/admin/admin-payments.component').then(
            (m) => m.AdminPaymentsComponent,
          ),
      },
      {
        path: 'payment-settings',
        loadComponent: () =>
          import('./features/admin/admin-payment-settings.component').then(
            (m) => m.AdminPaymentSettingsComponent,
          ),
      },
    ],
  },

  { path: '', pathMatch: 'full', redirectTo: 'app/my-bookings' },
  { path: '**', redirectTo: 'app/my-bookings' },
];
