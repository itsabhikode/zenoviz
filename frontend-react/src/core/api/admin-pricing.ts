import { apiClient } from './client'
import type { PricingConfigResponse, UpdatePricingRequest } from './models'

const BASE = '/admin/study-room'

export async function getPricing(): Promise<PricingConfigResponse> {
  const { data } = await apiClient.get<PricingConfigResponse>(`${BASE}/pricing`)
  return data
}

export async function updatePricing(body: UpdatePricingRequest): Promise<PricingConfigResponse> {
  const { data } = await apiClient.put<PricingConfigResponse>(`${BASE}/pricing`, body)
  return data
}
