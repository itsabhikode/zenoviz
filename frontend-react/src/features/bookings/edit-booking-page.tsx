import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import * as bookingsApi from '@/core/api/bookings'
import type { AccessType, AvailabilityRequest } from '@/core/api/models'
import { nprText } from '@/core/currency'
import { DatePicker } from '@/components/date-picker'
import { SeatGrid } from './seat-grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { cn } from '@/lib/utils'

function toIso(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

function endTimeForSlot(start: string): string {
  const [h] = start.split(':').map(Number)
  return `${String(h + 3).padStart(2, '0')}:00`
}

function toSlotStart(time: string): string {
  return time.slice(0, 2) + ':00'
}

export default function EditBookingPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: booking, isLoading: bookingLoading } = useQuery({
    queryKey: ['bookings', id],
    queryFn: () => bookingsApi.getBooking(id!),
    enabled: !!id,
  })

  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [accessType, setAccessType] = useState<AccessType>('timeslot')
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [seatId, setSeatId] = useState<number | null>(null)
  const [withLocker, setWithLocker] = useState(false)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (booking && !initialized) {
      setStartDate(parseISO(booking.start_date))
      setEndDate(parseISO(booking.end_date))
      setAccessType(booking.access_type)
      if (booking.access_type === 'timeslot') {
        setSelectedSlot(toSlotStart(booking.start_time))
      }
      setSeatId(booking.seat_id)
      setWithLocker(booking.with_locker)
      setInitialized(true)
    }
  }, [booking, initialized])

  const { data: pricing } = useQuery({
    queryKey: ['pricing', 'public'],
    queryFn: bookingsApi.publicPricing,
  })

  const availableSlots = useMemo(() => {
    const fallback = ['06:00', '09:00', '12:00', '15:00', '18:00']
    if (!pricing) return fallback
    const openH = Number.parseInt(pricing.business_open_time.split(':')[0], 10)
    const closeH = Number.parseInt(pricing.business_close_time.split(':')[0], 10)
    const slots: string[] = []
    for (let h = openH; h + 3 <= closeH; h += 3) {
      slots.push(`${String(h).padStart(2, '0')}:00`)
    }
    return slots.length > 0 ? slots : fallback
  }, [pricing])

  const canCheckSeats = !!startDate && !!endDate && (accessType === 'anytime' || !!selectedSlot)

  const seatsQuery = useQuery({
    queryKey: ['seats', 'availability', startDate && toIso(startDate), endDate && toIso(endDate), accessType, selectedSlot],
    queryFn: () =>
      bookingsApi.seatsAvailability({
        start_date: toIso(startDate!),
        end_date: toIso(endDate!),
        access_type: accessType,
        start_time: accessType === 'timeslot' && selectedSlot ? selectedSlot : null,
        end_time: accessType === 'timeslot' && selectedSlot ? endTimeForSlot(selectedSlot) : null,
      }),
    enabled: canCheckSeats,
  })

  const canCheckPrice = canCheckSeats && seatId !== null

  const availabilityQuery = useQuery({
    queryKey: ['bookings', 'availability', seatId, startDate && toIso(startDate), endDate && toIso(endDate), accessType, selectedSlot, withLocker],
    queryFn: () =>
      bookingsApi.checkAvailability({
        seat_id: seatId!,
        start_date: toIso(startDate!),
        end_date: toIso(endDate!),
        access_type: accessType,
        start_time: accessType === 'timeslot' && selectedSlot ? selectedSlot : null,
        end_time: accessType === 'timeslot' && selectedSlot ? endTimeForSlot(selectedSlot) : null,
        with_locker: withLocker,
      }),
    enabled: canCheckPrice,
  })

  const updateMutation = useMutation({
    mutationFn: (body: AvailabilityRequest) => bookingsApi.updateBooking(id!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      toast.success('Booking updated!')
      navigate('/app/my-bookings')
    },
    onError: (err) => {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? 'Update failed' : 'Update failed'
      toast.error(msg)
    },
  })

  const handleSubmit = () => {
    if (!startDate || !endDate || !seatId) return
    updateMutation.mutate({
      seat_id: seatId,
      start_date: toIso(startDate),
      end_date: toIso(endDate),
      access_type: accessType,
      start_time: accessType === 'timeslot' && selectedSlot ? selectedSlot : null,
      end_time: accessType === 'timeslot' && selectedSlot ? endTimeForSlot(selectedSlot) : null,
      with_locker: withLocker,
    })
  }

  if (bookingLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const avail = availabilityQuery.data
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit Booking</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Dates</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Start date</Label>
            <DatePicker value={startDate} onChange={setStartDate} disabled={(d) => d < today} />
          </div>
          <div className="space-y-2">
            <Label>End date</Label>
            <DatePicker value={endDate} onChange={setEndDate} disabled={(d) => d < (startDate ?? today)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Access Type</CardTitle></CardHeader>
        <CardContent>
          <RadioGroup value={accessType} onValueChange={(v) => setAccessType(v as AccessType)}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="timeslot" id="edit-timeslot" />
              <Label htmlFor="edit-timeslot">3-Hour Timeslot</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="anytime" id="edit-anytime" />
              <Label htmlFor="edit-anytime">Anytime (full day)</Label>
            </div>
          </RadioGroup>

          {accessType === 'timeslot' && (
            <div className="mt-4 flex flex-wrap gap-2">
              {availableSlots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={cn(
                    'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                    selectedSlot === slot
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card hover:border-primary hover:bg-primary/5',
                  )}
                >
                  {slot} – {endTimeForSlot(slot)}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {canCheckSeats && (
        <Card>
          <CardHeader><CardTitle className="text-base">Seat</CardTitle></CardHeader>
          <CardContent>
            {seatsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading seats…</p>
            ) : seatsQuery.data ? (
              <SeatGrid
                totalSeats={seatsQuery.data.total_seats}
                unavailableSeatIds={seatsQuery.data.unavailable_seat_ids}
                disabledSeatIds={seatsQuery.data.disabled_seat_ids ?? []}
                selectedSeatId={seatId}
                onSelect={setSeatId}
              />
            ) : null}
          </CardContent>
        </Card>
      )}

      {canCheckPrice && (
        <Card>
          <CardHeader><CardTitle className="text-base">Updated Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox id="edit-locker" checked={withLocker} onCheckedChange={(v) => setWithLocker(v === true)} />
              <Label htmlFor="edit-locker">Add locker</Label>
            </div>
            <Separator />

            {availabilityQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Checking price…</p>
            ) : avail ? (
              <>
                {!avail.available && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {avail.reason ?? 'Not available for selected dates.'}
                  </div>
                )}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span>{avail.breakdown.category}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Duration</span><span>{avail.breakdown.duration_days} days</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Rate/day</span><span>{nprText(avail.breakdown.per_day_rate)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Base</span><span>{nprText(avail.breakdown.base)}</span></div>
                  {withLocker && (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">Locker/day</span><span>{nprText(avail.breakdown.locker_per_day)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Locker fee</span><span>{nprText(avail.breakdown.locker_fee)}</span></div>
                    </>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold"><span>Total</span><span>{nprText(avail.final_price)}</span></div>
                </div>

                {booking && Number.parseFloat(booking.paid_amount) > 0 && (
                  <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    Previously paid: {nprText(booking.paid_amount)}. Amount due after edit: {nprText(avail.final_price)}
                  </div>
                )}

                <Button className="mt-4 w-full" onClick={handleSubmit} disabled={!avail.available || updateMutation.isPending}>
                  {updateMutation.isPending ? 'Updating…' : 'Update Booking'}
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
