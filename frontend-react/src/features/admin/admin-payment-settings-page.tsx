import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import * as adminPaymentsApi from '@/core/api/admin-payments'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { Upload } from 'lucide-react'

const settingsSchema = z.object({
  upi_vpa: z.string().nullable(),
  payee_name: z.string().nullable(),
  instructions: z.string().nullable(),
})

type SettingsForm = z.infer<typeof settingsSchema>

export default function AdminPaymentSettingsPage() {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payment-settings'],
    queryFn: adminPaymentsApi.getPaymentSettings,
  })

  const { register, handleSubmit, reset } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
  })

  useEffect(() => {
    if (data) reset({ upi_vpa: data.upi_vpa, payee_name: data.payee_name, instructions: data.instructions })
  }, [data, reset])

  const saveMutation = useMutation({
    mutationFn: adminPaymentsApi.updatePaymentSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'payment-settings'] })
      toast.success('Settings saved')
    },
    onError: (err) => {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? 'Save failed' : 'Save failed'
      toast.error(msg)
    },
  })

  const uploadQrMutation = useMutation({
    mutationFn: adminPaymentsApi.uploadPaymentQr,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'payment-settings'] })
      toast.success('QR code uploaded')
    },
    onError: () => toast.error('QR upload failed'),
  })

  const [qrPreview, setQrPreview] = useState<string | null>(null)

  useEffect(() => {
    if (data?.has_qr) {
      adminPaymentsApi.paymentQrBlob().then((blob) => {
        setQrPreview(URL.createObjectURL(blob))
      }).catch(() => {})
    }
    return () => { if (qrPreview) URL.revokeObjectURL(qrPreview) }
  }, [data?.has_qr])

  if (isLoading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Payment Settings</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Payment Details</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4">
              <div className="space-y-2">
                <Label>UPI VPA</Label>
                <Input {...register('upi_vpa')} placeholder="merchant@upi" />
              </div>
              <div className="space-y-2">
                <Label>Payee name</Label>
                <Input {...register('payee_name')} placeholder="Business Name" />
              </div>
              <div className="space-y-2">
                <Label>Instructions</Label>
                <Input {...register('instructions')} placeholder="Payment instructions for users" />
              </div>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save settings'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">QR Code</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {qrPreview && (
              <img src={qrPreview} alt="Payment QR" className="mx-auto h-48 w-48 rounded border" />
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileRef.current?.click()}
              disabled={uploadQrMutation.isPending}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploadQrMutation.isPending ? 'Uploading...' : 'Upload QR Code'}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) uploadQrMutation.mutate(file)
                e.target.value = ''
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
