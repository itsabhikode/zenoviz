import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/core/auth/auth-context'

vi.mock('@/core/api/auth', () => ({
  me: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  googleOAuthAvailable: vi.fn(() => false),
}))

vi.mock('@/core/auth/token-storage', () => ({
  tokenStorage: {
    isAuthenticated: vi.fn(() => false),
    clear: vi.fn(),
  },
}))

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders children when no token (not loading, shows "No user")', async () => {
    function TestChild() {
      const { user, isLoading } = useAuth()
      if (isLoading) return <div>Loading...</div>
      return <div>{user ? user.email : 'No user'}</div>
    }

    render(
      <AuthProvider>
        <TestChild />
      </AuthProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('No user')).toBeInTheDocument()
    })
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  it('throws error when useAuth used outside AuthProvider', () => {
    function BadComponent() {
      useAuth()
      return null
    }

    // Suppress the error boundary console output
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<BadComponent />)).toThrow('useAuth must be used within AuthProvider')
    spy.mockRestore()
  })
})
