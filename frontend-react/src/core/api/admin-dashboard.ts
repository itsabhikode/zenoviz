import { apiClient } from './client'

export interface DashboardStats {
  total_bookings: number
  status_counts: Record<string, number>
  total_revenue: number
  pending_revenue: number
  total_seats: number
  enabled_seats: number
  unique_users: number
  gallery_count: number
  recent_bookings: Array<{
    id: string
    seat_id: number
    start_date: string
    end_date: string
    status: string
    final_price: number
    amount_due: number
    access_type: string
    user?: { email: string; given_name: string | null; family_name: string | null } | null
    created_at: string
  }>
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await apiClient.get<DashboardStats>('/admin/study-room/dashboard')
  return data
}
