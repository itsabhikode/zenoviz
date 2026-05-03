import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import * as adminPricingApi from '@/core/api/admin-pricing'
import type { UpdatePricingRequest } from '@/core/api/models'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { RefreshCw } from 'lucide-react'

const pricingSchema = z.object({
  timeslot_daily_price: z.coerce.number().min(0),
  timeslot_weekly_price: z.coerce.number().min(0),
  timeslot_monthly_price: z.coerce.number().min(0),
  anytime_daily_price: z.coerce.number().min(0),
  anytime_weekly_price: z.coerce.number().min(0),
  anytime_monthly_price: z.coerce.number().min(0),
  locker_daily_price: z.coerce.number().min(0),
  locker_weekly_price: z.coerce.number().min(0),
  locker_monthly_price: z.coerce.number().min(0),
  reservation_timeout_minutes: z.coerce.number().min(1),
  business_open_time: z.string().min(1),
  business_close_time: z.string().min(1),
})

type PricingForm = z.infer<typeof pricingSchema>

export default function AdminPricingPage() {
  const queryClient = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'pricing'],
    queryFn: adminPricingApi.getPricing,
  })

  const { register, handleSubmit, reset } = useForm<PricingForm>({
    resolver: zodResolver(pricingSchema) as never,
  })

  useEffect(() => {
    if (data) reset(data)
  }, [data, reset])

  const saveMutation = useMutation({
    mutationFn: adminPricingApi.updatePricing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] })
      toast.success('Pricing updated')
    },
    onError: (err) => {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? 'Save failed' : 'Save failed'
      toast.error(msg)
    },
  })

  if (isLoading) return <Skeleton className="h-96 w-full" />

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Pricing Configuration</h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit((v) => saveMutation.mutate(v as unknown as UpdatePricingRequest))} className="space-y-6">
            <section>
              <h3 className="mb-3 font-medium">3-Hour (Timeslot) prices (NPR/day)</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1"><Label>Daily</Label><Input type="number" {...register('timeslot_daily_price')} /></div>
                <div className="space-y-1"><Label>Weekly</Label><Input type="number" {...register('timeslot_weekly_price')} /></div>
                <div className="space-y-1"><Label>Monthly</Label><Input type="number" {...register('timeslot_monthly_price')} /></div>
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="mb-3 font-medium">Anytime prices (NPR/day)</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1"><Label>Daily</Label><Input type="number" {...register('anytime_daily_price')} /></div>
                <div className="space-y-1"><Label>Weekly</Label><Input type="number" {...register('anytime_weekly_price')} /></div>
                <div className="space-y-1"><Label>Monthly</Label><Input type="number" {...register('anytime_monthly_price')} /></div>
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="mb-3 font-medium">Locker add-on (NPR/day)</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1"><Label>Daily</Label><Input type="number" {...register('locker_daily_price')} /></div>
                <div className="space-y-1"><Label>Weekly</Label><Input type="number" {...register('locker_weekly_price')} /></div>
                <div className="space-y-1"><Label>Monthly</Label><Input type="number" {...register('locker_monthly_price')} /></div>
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="mb-3 font-medium">Rules</h3>
              <div className="max-w-xs space-y-1">
                <Label>Reservation timeout (min)</Label>
                <Input type="number" {...register('reservation_timeout_minutes')} />
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="mb-3 font-medium">Business hours</h3>
              <div className="grid max-w-md gap-4 sm:grid-cols-2">
                <div className="space-y-1"><Label>Open</Label><Input type="time" {...register('business_open_time')} /></div>
                <div className="space-y-1"><Label>Close</Label><Input type="time" {...register('business_close_time')} /></div>
              </div>
            </section>

            <div className="flex gap-3">
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save pricing'}
              </Button>
              <Button type="button" variant="outline" onClick={() => refetch()} disabled={isLoading}>
                <RefreshCw className="mr-2 h-4 w-4" /> Reload
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
