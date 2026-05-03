import { Navigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/core/auth/auth-context'
import * as bookingsApi from '@/core/api/bookings'
import { hasBlockingBooking } from '@/core/booking/booking-rules'
import type { ReactNode } from 'react'

export function BookRoute({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth()
  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['bookings', 'mine'],
    queryFn: bookingsApi.myBookings,
    enabled: !!user,
  })
  if (authLoading || bookingsLoading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (bookings && hasBlockingBooking(bookings)) return <Navigate to="/app/my-bookings?notice=one-booking" replace />
  return <>{children}</>
}
