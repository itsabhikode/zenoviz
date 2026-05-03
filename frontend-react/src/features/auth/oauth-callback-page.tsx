import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import * as authApi from '@/core/api/auth'
import { useAuth } from '@/core/auth/auth-context'

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const code = searchParams.get('code')
    if (!code) {
      setError('No authorization code received')
      return
    }

    authApi
      .exchangeOAuthCode(code)
      .then(() => authApi.me())
      .then((user) => {
        setUser(user)
        const returnTo = authApi.consumeOAuthReturnPath() || '/app/my-bookings'
        navigate(returnTo, { replace: true })
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'OAuth exchange failed')
      })
  }, [searchParams, navigate, setUser])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">{error}</p>
          <a href="/login" className="mt-4 text-primary hover:underline">Back to login</a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}
