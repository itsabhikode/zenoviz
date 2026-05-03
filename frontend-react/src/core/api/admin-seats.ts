import { apiClient } from './client'
import type { SeatResponse, UpdateSeatEnabledRequest } from './models'

const BASE = '/admin/study-room'

export async function listSeats(): Promise<SeatResponse[]> {
  const { data } = await apiClient.get<SeatResponse[]>(`${BASE}/seats`)
  return data
}

export async function patchSeat(
  seatId: number,
  body: UpdateSeatEnabledRequest,
): Promise<SeatResponse> {
  const { data } = await apiClient.patch<SeatResponse>(`${BASE}/seats/${seatId}`, body)
  return data
}
