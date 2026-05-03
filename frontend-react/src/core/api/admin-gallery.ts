import { apiClient } from './client'
import type { GalleryImageResponse, UpdateGalleryImageRequest } from './models'

const BASE = '/admin/study-room/gallery'

export async function listGallery(): Promise<GalleryImageResponse[]> {
  const { data } = await apiClient.get<GalleryImageResponse[]>(BASE)
  return data
}

export async function uploadGalleryImage(
  file: File,
  title: string = '',
  altText: string = '',
  sortOrder: number = 0,
): Promise<GalleryImageResponse> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('title', title)
  formData.append('alt_text', altText)
  formData.append('sort_order', String(sortOrder))
  const { data } = await apiClient.post<GalleryImageResponse>(BASE, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function updateGalleryImage(
  id: string,
  body: UpdateGalleryImageRequest,
): Promise<GalleryImageResponse> {
  const { data } = await apiClient.put<GalleryImageResponse>(`${BASE}/${id}`, body)
  return data
}

export async function deleteGalleryImage(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`)
}
