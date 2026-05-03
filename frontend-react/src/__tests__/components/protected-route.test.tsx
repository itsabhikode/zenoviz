import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ProtectedRoute } from '@/components/protected-route'
import type { MeResponse } from '@/core/api/models'

vi.mock('@/core/auth/auth-context', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '@/core/auth/auth-context'

const mockUseAuth = vi.mocked(useAuth)

describe('ProtectedRoute', () => {
  it('shows loading spinner when isLoading=true', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAdmin: false,
      isLoading: true,
      googleOAuthAvailable: false,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
    })

    const { container } = render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected content</div>
        </ProtectedRoute>
      </MemoryRouter>,
    )

    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('renders children when authenticated (user exists)', () => {
    const fakeUser: MeResponse = {
      user_id: 'user-1',
      email: 'test@example.com',
      roles: ['user'],
    }

    mockUseAuth.mockReturnValue({
      user: fakeUser,
      isAdmin: false,
      isLoading: false,
      googleOAuthAvailable: false,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
    })

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected content</div>
        </ProtectedRoute>
      </MemoryRouter>,
    )

    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })
})
