import { useState } from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import * as authApi from '@/core/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'

const requestSchema = z.object({ email: z.string().email() })
const confirmSchema = z.object({
  email: z.string().email(),
  confirmationCode: z.string().min(1, 'Code is required'),
  newPassword: z.string().min(8, 'At least 8 characters'),
})

type RequestForm = z.infer<typeof requestSchema>
type ConfirmForm = z.infer<typeof confirmSchema>

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'request' | 'confirm'>('request')
  const [email, setEmail] = useState('')

  const reqForm = useForm<RequestForm>({ resolver: zodResolver(requestSchema) })
  const confForm = useForm<ConfirmForm>({ resolver: zodResolver(confirmSchema) })

  const onRequest = async (data: RequestForm) => {
    try {
      await authApi.forgotPassword(data.email)
      setEmail(data.email)
      confForm.setValue('email', data.email)
      setStep('confirm')
      toast.success('Verification code sent to your email')
    } catch (err) {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? 'Request failed' : 'Request failed'
      toast.error(msg)
    }
  }

  const onConfirm = async (data: ConfirmForm) => {
    try {
      await authApi.confirmForgotPassword(data.email, data.confirmationCode, data.newPassword)
      toast.success('Password reset! Please sign in.')
      window.location.href = '/login'
    } catch (err) {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? 'Reset failed' : 'Reset failed'
      toast.error(msg)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {step === 'request' ? 'Forgot password' : 'Reset password'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 'request' ? (
            <form onSubmit={reqForm.handleSubmit(onRequest)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fp-email">Email</Label>
                <Input id="fp-email" type="email" {...reqForm.register('email')} />
                {reqForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{reqForm.formState.errors.email.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={reqForm.formState.isSubmitting}>
                Send code
              </Button>
            </form>
          ) : (
            <form onSubmit={confForm.handleSubmit(onConfirm)} className="space-y-4">
              <p className="text-sm text-muted-foreground">Code sent to {email}</p>
              <input type="hidden" {...confForm.register('email')} />
              <div className="space-y-2">
                <Label htmlFor="code">Verification code</Label>
                <Input id="code" {...confForm.register('confirmationCode')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pw">New password</Label>
                <Input id="new-pw" type="password" {...confForm.register('newPassword')} />
              </div>
              <Button type="submit" className="w-full" disabled={confForm.formState.isSubmitting}>
                Reset password
              </Button>
            </form>
          )}
          <p className="mt-4 text-center text-sm">
            <Link to="/login" className="text-primary hover:underline">Back to sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
