import { apiClient } from './client'
import type {
  AvailabilityRequest,
  AvailabilityResponse,
  SeatsAvailabilityRequest,
  SeatsAvailabilityResponse,
  CreateBookingRequest,
  BookingResponse,
  GalleryImageResponse,
  PaymentSettingsResponse,
  PricingConfigResponse,
} from './models'

export async function checkAvailability(body: AvailabilityRequest): Promise<AvailabilityResponse> {
  const { data } = await apiClient.post<AvailabilityResponse>('/study-room/availability', body)
  return data
}

export async function seatsAvailability(
  body: SeatsAvailabilityRequest,
): Promise<SeatsAvailabilityResponse> {
  const { data } = await apiClient.post<SeatsAvailabilityResponse>(
    '/study-room/seats/availability',
    body,
  )
  return data
}

export async function createBooking(body: CreateBookingRequest): Promise<BookingResponse> {
  const { data } = await apiClient.post<BookingResponse>('/study-room/bookings', body)
  return data
}

export async function updateBooking(
  bookingId: string,
  body: Partial<CreateBookingRequest>,
): Promise<BookingResponse> {
  const { data } = await apiClient.put<BookingResponse>(`/study-room/bookings/${bookingId}`, body)
  return data
}

export async function getBooking(bookingId: string): Promise<BookingResponse> {
  const { data } = await apiClient.get<BookingResponse>(`/study-room/bookings/${bookingId}`)
  return data
}

export async function myBookings(): Promise<BookingResponse[]> {
  const { data } = await apiClient.get<BookingResponse[]>('/study-room/bookings')
  return data
}

export async function uploadPaymentProof(bookingId: string, file: File): Promise<BookingResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await apiClient.post<BookingResponse>(
    `/study-room/bookings/${bookingId}/payment-proof`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data
}

export async function paymentSettings(): Promise<PaymentSettingsResponse> {
  const { data } = await apiClient.get<PaymentSettingsResponse>('/study-room/payment-settings')
  return data
}

export async function paymentQrBlob(): Promise<Blob> {
  const { data } = await apiClient.get<Blob>('/study-room/payment-settings/qr', {
    responseType: 'blob',
  })
  return data
}

export async function publicPricing(): Promise<PricingConfigResponse> {
  const { data } = await apiClient.get<PricingConfigResponse>('/study-room/pricing')
  return data
}

export async function publicGallery(): Promise<GalleryImageResponse[]> {
  const { data } = await apiClient.get<GalleryImageResponse[]>('/study-room/gallery')
  return data
}
