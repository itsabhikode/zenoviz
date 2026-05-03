import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
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

export default function CreateBookingPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [accessType, setAccessType] = useState<AccessType>('timeslot')
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [seatId, setSeatId] = useState<number | null>(null)
  const [withLocker, setWithLocker] = useState(false)

  const { data: pricing } = useQuery({
    queryKey: ['pricing', 'public'],
    queryFn: bookingsApi.publicPricing,
  })

  const availableSlots = useMemo(() => {
    const fallback = ['06:00', '09:00', '12:00', '15:00', '18:00']
    if (!pricing) return fallback
    const openH = parseInt(pricing.business_open_time.split(':')[0], 10)
    const closeH = parseInt(pricing.business_close_time.split(':')[0], 10)
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

  useEffect(() => { setSeatId(null) }, [startDate, endDate, accessType, selectedSlot])
  useEffect(() => { if (accessType === 'anytime') setSelectedSlot(null) }, [accessType])

  const createMutation = useMutation({
    mutationFn: bookingsApi.createBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', 'mine'] })
      toast.success('Booking created!')
      navigate('/app/my-bookings')
    },
    onError: (err) => {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? 'Booking failed' : 'Booking failed'
      toast.error(msg)
    },
  })

  const handleSubmit = () => {
    if (!startDate || !endDate || !seatId) return
    const body: AvailabilityRequest = {
      seat_id: seatId,
      start_date: toIso(startDate),
      end_date: toIso(endDate),
      access_type: accessType,
      start_time: accessType === 'timeslot' && selectedSlot ? selectedSlot : null,
      end_time: accessType === 'timeslot' && selectedSlot ? endTimeForSlot(selectedSlot) : null,
      with_locker: withLocker,
    }
    createMutation.mutate(body)
  }

  const avail = availabilityQuery.data
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Book a Seat</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Select Dates</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Start date</Label>
            <DatePicker value={startDate} onChange={setStartDate} disabled={(d) => d < today} placeholder="Start date" />
          </div>
          <div className="space-y-2">
            <Label>End date</Label>
            <DatePicker value={endDate} onChange={setEndDate} disabled={(d) => d < (startDate ?? today)} placeholder="End date" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Access Type</CardTitle></CardHeader>
        <CardContent>
          <RadioGroup value={accessType} onValueChange={(v) => setAccessType(v as AccessType)}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="timeslot" id="timeslot" />
              <Label htmlFor="timeslot">3-Hour Timeslot</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="anytime" id="anytime" />
              <Label htmlFor="anytime">Anytime (full day)</Label>
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
          <CardHeader><CardTitle className="text-base">Choose a Seat</CardTitle></CardHeader>
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
          <CardHeader><CardTitle className="text-base">Booking Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox id="locker" checked={withLocker} onCheckedChange={(v) => setWithLocker(v === true)} />
              <Label htmlFor="locker">Add locker</Label>
            </div>
            <Separator />

            {availabilityQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Checking price…</p>
            ) : avail ? (
              <>
                {!avail.available && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {avail.reason ?? 'This seat is not available for the selected dates.'}
                  </div>
                )}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span>{avail.breakdown.category}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Duration</span><span>{avail.breakdown.duration_days} days</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Rate per day</span><span>{nprText(avail.breakdown.per_day_rate)}</span></div>
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
                <Button className="mt-4 w-full" onClick={handleSubmit} disabled={!avail.available || createMutation.isPending}>
                  {createMutation.isPending ? 'Creating…' : 'Confirm Booking'}
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
