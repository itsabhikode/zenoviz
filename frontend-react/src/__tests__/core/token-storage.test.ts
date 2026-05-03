import { describe, it, expect, beforeEach } from 'vitest'
import { tokenStorage } from '@/core/auth/token-storage'

describe('tokenStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('accessToken', () => {
    it('returns null when no token stored', () => {
      expect(tokenStorage.accessToken).toBeNull()
    })

    it('returns the stored access token', () => {
      localStorage.setItem('zv.access_token', 'test-access-token')
      expect(tokenStorage.accessToken).toBe('test-access-token')
    })
  })

  describe('refreshToken', () => {
    it('returns null when no token stored', () => {
      expect(tokenStorage.refreshToken).toBeNull()
    })

    it('returns the stored refresh token', () => {
      localStorage.setItem('zv.refresh_token', 'test-refresh-token')
      expect(tokenStorage.refreshToken).toBe('test-refresh-token')
    })
  })

  describe('setTokens', () => {
    it('stores access token', () => {
      tokenStorage.setTokens('my-access')
      expect(localStorage.getItem('zv.access_token')).toBe('my-access')
    })

    it('stores both access and refresh tokens', () => {
      tokenStorage.setTokens('my-access', 'my-refresh')
      expect(localStorage.getItem('zv.access_token')).toBe('my-access')
      expect(localStorage.getItem('zv.refresh_token')).toBe('my-refresh')
    })

    it('does not store refresh token when null', () => {
      tokenStorage.setTokens('my-access', null)
      expect(localStorage.getItem('zv.refresh_token')).toBeNull()
    })

    it('does not store refresh token when undefined', () => {
      tokenStorage.setTokens('my-access')
      expect(localStorage.getItem('zv.refresh_token')).toBeNull()
    })
  })

  describe('setAccessToken', () => {
    it('updates only the access token', () => {
      localStorage.setItem('zv.refresh_token', 'existing-refresh')
      tokenStorage.setAccessToken('new-access')
      expect(localStorage.getItem('zv.access_token')).toBe('new-access')
      expect(localStorage.getItem('zv.refresh_token')).toBe('existing-refresh')
    })

    it('does not touch refresh token if not set', () => {
      tokenStorage.setAccessToken('new-access')
      expect(localStorage.getItem('zv.refresh_token')).toBeNull()
    })
  })

  describe('clear', () => {
    it('removes both tokens', () => {
      localStorage.setItem('zv.access_token', 'access')
      localStorage.setItem('zv.refresh_token', 'refresh')
      tokenStorage.clear()
      expect(localStorage.getItem('zv.access_token')).toBeNull()
      expect(localStorage.getItem('zv.refresh_token')).toBeNull()
    })

    it('does not throw if tokens were not set', () => {
      expect(() => tokenStorage.clear()).not.toThrow()
    })
  })

  describe('isAuthenticated', () => {
    it('returns false when no access token', () => {
      expect(tokenStorage.isAuthenticated()).toBe(false)
    })

    it('returns true when access token is present', () => {
      localStorage.setItem('zv.access_token', 'some-token')
      expect(tokenStorage.isAuthenticated()).toBe(true)
    })

    it('returns false after clear()', () => {
      localStorage.setItem('zv.access_token', 'some-token')
      tokenStorage.clear()
      expect(tokenStorage.isAuthenticated()).toBe(false)
    })
  })
})
