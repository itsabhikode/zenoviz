import axios from 'axios'
import { tokenStorage } from '@/core/auth/token-storage'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export const apiClient = axios.create({ baseURL: API_BASE_URL })

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // Don't redirect during OAuth callback — it handles errors itself
      if (!window.location.pathname.startsWith('/auth/callback')) {
        tokenStorage.clear()
        const returnTo = window.location.pathname
        window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`
      }
    }
    return Promise.reject(error)
  },
)

export { default as plainAxios } from 'axios'
