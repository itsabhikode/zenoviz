import { apiClient } from './client'
import type { BookingResponse, ApiMessageResponse } from './models'

const BASE = '/admin/study-room'

export async function allBookings(statusFilter?: string): Promise<BookingResponse[]> {
  const params = statusFilter ? { status: statusFilter } : undefined
  const { data } = await apiClient.get<BookingResponse[]>(`${BASE}/bookings`, { params })
  return data
}

export async function pendingPayments(): Promise<BookingResponse[]> {
  const { data } = await apiClient.get<BookingResponse[]>(`${BASE}/bookings/pending-payments`)
  return data
}

export async function approvePayment(
  bookingId: string,
  amount?: number,
): Promise<ApiMessageResponse> {
  const body = amount !== undefined ? { amount } : {}
  const { data } = await apiClient.post<ApiMessageResponse>(
    `${BASE}/bookings/${bookingId}/approve`,
    body,
  )
  return data
}

export async function rejectPayment(bookingId: string): Promise<ApiMessageResponse> {
  const { data } = await apiClient.post<ApiMessageResponse>(
    `${BASE}/bookings/${bookingId}/reject`,
  )
  return data
}

export async function downloadPaymentProof(bookingId: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`${BASE}/bookings/${bookingId}/payment-proof`, {
    responseType: 'blob',
  })
  return data
}
