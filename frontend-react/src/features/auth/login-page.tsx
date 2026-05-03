import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/core/auth/auth-context'
import * as authApi from '@/core/api/auth'
import * as bookingsApi from '@/core/api/bookings'
import { nprText } from '@/core/currency'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { login, googleOAuthAvailable } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('returnTo') || '/app/my-bookings'
  const [showForm, setShowForm] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const { data: pricing } = useQuery({
    queryKey: ['pricing', 'public'],
    queryFn: bookingsApi.publicPricing,
  })

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password)
      navigate(returnTo, { replace: true })
    } catch (err) {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? 'Login failed' : 'Login failed'
      toast.error(msg)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left hero — violet gradient + pricing */}
      <div className="relative hidden w-1/2 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 p-12 text-white lg:flex">
        {/* Decorative circles */}
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute right-12 top-12 h-24 w-24 rounded-full bg-white/10" />

        <div className="relative max-w-md text-center">
          <h1 className="text-4xl font-bold tracking-tight drop-shadow-sm">Zenoviz Study Room</h1>
          <p className="mt-3 text-lg text-violet-100/90">
            Reserve your perfect study spot — quiet, focused, affordable.
          </p>

          {pricing && (
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-md">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-violet-200">
                Pricing (per day)
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-violet-100">3-Hour Slot (daily)</span>
                  <span className="font-semibold">{nprText(pricing.timeslot_daily_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-violet-100">3-Hour Slot (weekly)</span>
                  <span className="font-semibold">{nprText(pricing.timeslot_weekly_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-violet-100">3-Hour Slot (monthly)</span>
                  <span className="font-semibold">{nprText(pricing.timeslot_monthly_price)}</span>
                </div>
                <div className="my-2 border-t border-white/20" />
                <div className="flex justify-between">
                  <span className="text-violet-100">Anytime (daily)</span>
                  <span className="font-semibold">{nprText(pricing.anytime_daily_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-violet-100">Anytime (weekly)</span>
                  <span className="font-semibold">{nprText(pricing.anytime_weekly_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-violet-100">Anytime (monthly)</span>
                  <span className="font-semibold">{nprText(pricing.anytime_monthly_price)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right form card */}
      <div className="flex w-full items-center justify-center bg-white px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Mobile hero */}
          <div className="mb-8 text-center lg:hidden">
            <h1 className="text-2xl font-bold text-primary">Zenoviz Study Room</h1>
            <p className="mt-1 text-sm text-muted-foreground">Reserve your perfect study spot.</p>
            {!showForm && (
              <Button className="mt-4 w-full" onClick={() => setShowForm(true)}>Book now</Button>
            )}
          </div>

          <div className={`${!showForm ? 'hidden lg:block' : ''}`}>
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-xl">Sign in</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="you@example.com" {...register('email')} aria-invalid={!!errors.email} />
                    {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" {...register('password')} aria-invalid={!!errors.password} />
                    {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                  </div>

                  <Button type="submit" className="btn-gradient w-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Signing in...' : 'Sign in'}
                  </Button>

                  {googleOAuthAvailable && (
                    <>
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-card px-2 text-muted-foreground">or</span>
                        </div>
                      </div>
                      <Button type="button" variant="outline" className="w-full" onClick={() => authApi.startGoogleOAuth(returnTo)}>
                        Continue with Google
                      </Button>
                    </>
                  )}
                </form>

                <div className="mt-4 space-y-2 text-center text-sm">
                  <Link to="/forgot-password" className="text-primary hover:underline">Forgot password?</Link>
                  <p className="text-muted-foreground">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-primary hover:underline">Register</Link>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
