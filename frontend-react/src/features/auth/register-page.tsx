import { useNavigate, Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import * as authApi from '@/core/api/auth'
import { useAuth } from '@/core/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'

const registerSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
  given_name: z.string().min(1, 'First name is required'),
  family_name: z.string().min(1, 'Last name is required'),
  phone_number: z.string().min(1, 'Phone number is required'),
  gender: z.enum(['male', 'female', 'other'], { message: 'Select a gender' }),
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const { googleOAuthAvailable } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })

  const onSubmit = async (data: RegisterForm) => {
    try {
      await authApi.register(data)
      toast.success('Account created! Please sign in.')
      navigate('/login')
    } catch (err) {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? 'Registration failed' : 'Registration failed'
      toast.error(msg)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create an account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="given_name">First name</Label>
                <Input id="given_name" {...register('given_name')} />
                {errors.given_name && <p className="text-sm text-destructive">{errors.given_name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="family_name">Last name</Label>
                <Input id="family_name" {...register('family_name')} />
                {errors.family_name && <p className="text-sm text-destructive">{errors.family_name.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-email">Email</Label>
              <Input id="reg-email" type="email" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-password">Password</Label>
              <Input id="reg-password" type="password" {...register('password')} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone number</Label>
              <Input id="phone_number" {...register('phone_number')} />
              {errors.phone_number && <p className="text-sm text-destructive">{errors.phone_number.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Gender</Label>
              <Select onValueChange={(v) => setValue('gender', v as RegisterForm['gender'])}>
                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {errors.gender && <p className="text-sm text-destructive">{errors.gender.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account…' : 'Register'}
            </Button>

            {googleOAuthAvailable && (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={() => authApi.startGoogleOAuth('/app/my-bookings')}>
                  Continue with Google
                </Button>
              </>
            )}
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
