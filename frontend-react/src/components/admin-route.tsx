import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@/core/auth/auth-context'
import type { ReactNode } from 'react'

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isAdmin, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
  if (!user) return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname)}`} replace />
  if (!isAdmin) return <Navigate to="/app/my-bookings" replace />
  return <>{children}</>
}
