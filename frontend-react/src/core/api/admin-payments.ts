import { apiClient } from './client'
import type { PaymentSettingsResponse, UpdatePaymentSettingsRequest, ApiMessageResponse } from './models'

const BASE = '/admin/study-room'

export async function getPaymentSettings(): Promise<PaymentSettingsResponse> {
  const { data } = await apiClient.get<PaymentSettingsResponse>(`${BASE}/payment-settings`)
  return data
}

export async function updatePaymentSettings(
  body: UpdatePaymentSettingsRequest,
): Promise<PaymentSettingsResponse> {
  const { data } = await apiClient.put<PaymentSettingsResponse>(`${BASE}/payment-settings`, body)
  return data
}

export async function uploadPaymentQr(file: File): Promise<ApiMessageResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await apiClient.post<ApiMessageResponse>(
    `${BASE}/payment-settings/qr`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data
}

export async function paymentQrBlob(): Promise<Blob> {
  const { data } = await apiClient.get<Blob>('/study-room/payment-settings/qr', {
    responseType: 'blob',
  })
  return data
}
