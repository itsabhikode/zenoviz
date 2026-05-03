import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { MeResponse } from '@/core/api/models'
import * as authApi from '@/core/api/auth'
import { tokenStorage } from './token-storage'

interface AuthContextValue {
  user: MeResponse | null
  isAdmin: boolean
  isLoading: boolean
  googleOAuthAvailable: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setUser: (user: MeResponse) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const isAdmin = user?.roles.includes('admin') ?? false

  useEffect(() => {
    if (!tokenStorage.isAuthenticated()) { setIsLoading(false); return }
    authApi.me()
      .then((u) => setUser(u))
      .catch(() => tokenStorage.clear())
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    await authApi.login(email, password)
    const u = await authApi.me()
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    authApi.logout()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isAdmin, isLoading, googleOAuthAvailable: authApi.googleOAuthAvailable(), login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
