import { Routes } from '@angular/router';

import { bookRouteGuard } from './core/booking/book-route.guard';
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
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/auth/oauth-callback.component').then((m) => m.OAuthCallbackComponent),
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
        canActivate: [bookRouteGuard],
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
        path: 'seats',
        loadComponent: () =>
          import('./features/admin/admin-seats.component').then(
            (m) => m.AdminSeatsComponent,
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
