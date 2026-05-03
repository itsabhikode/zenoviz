import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { queryClient } from '@/lib/query-client'
import { AuthProvider } from '@/core/auth/auth-context'
import { ProtectedRoute } from '@/components/protected-route'
import { AdminRoute } from '@/components/admin-route'
import { BookRoute } from '@/components/book-route'
import { CommandPalette } from '@/components/command-palette'

const LandingPage = lazy(() => import('@/features/landing/landing-page'))
const LoginPage = lazy(() => import('@/features/auth/login-page'))
const RegisterPage = lazy(() => import('@/features/auth/register-page'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/forgot-password-page'))
const OAuthCallbackPage = lazy(() => import('@/features/auth/oauth-callback-page'))
const MyBookingsPage = lazy(() => import('@/features/bookings/my-bookings-page'))
const CreateBookingPage = lazy(() => import('@/features/bookings/create-booking-page'))
const EditBookingPage = lazy(() => import('@/features/bookings/edit-booking-page'))
const AdminUsersPage = lazy(() => import('@/features/admin/admin-users-page'))
const AdminRolesPage = lazy(() => import('@/features/admin/admin-roles-page'))
const AdminPricingPage = lazy(() => import('@/features/admin/admin-pricing-page'))
const AdminSeatsPage = lazy(() => import('@/features/admin/admin-seats-page'))
const AdminBookingsPage = lazy(() => import('@/features/admin/admin-bookings-page'))
const AdminPaymentsPage = lazy(() => import('@/features/admin/admin-payments-page'))
const AdminPaymentSettingsPage = lazy(() => import('@/features/admin/admin-payment-settings-page'))
const AdminGalleryPage = lazy(() => import('@/features/admin/admin-gallery-page'))
const AdminDashboardPage = lazy(() => import('@/features/admin/admin-dashboard-page'))
const UserShell = lazy(() => import('@/core/layout/user-shell'))
const AdminShell = lazy(() => import('@/core/layout/admin-shell'))

const Spinner = (
  <div className="flex h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
)

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={Spinner}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/auth/callback" element={<OAuthCallbackPage />} />

              <Route
                path="/app"
                element={
                  <ProtectedRoute>
                    <UserShell />
                  </ProtectedRoute>
                }
              >
                <Route path="my-bookings" element={<MyBookingsPage />} />
                <Route
                  path="book"
                  element={
                    <BookRoute>
                      <CreateBookingPage />
                    </BookRoute>
                  }
                />
                <Route path="bookings/:id/edit" element={<EditBookingPage />} />
              </Route>

              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminShell />
                  </AdminRoute>
                }
              >
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="roles" element={<AdminRolesPage />} />
                <Route path="pricing" element={<AdminPricingPage />} />
                <Route path="seats" element={<AdminSeatsPage />} />
                <Route path="bookings" element={<AdminBookingsPage />} />
                <Route path="payments" element={<AdminPaymentsPage />} />
                <Route path="payment-settings" element={<AdminPaymentSettingsPage />} />
                <Route path="gallery" element={<AdminGalleryPage />} />
              </Route>

              <Route path="/" element={<LandingPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <CommandPalette />
          <Toaster position="top-right" />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
