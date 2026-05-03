import { useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, Link } from 'react-router'
import * as bookingsApi from '@/core/api/bookings'
import { nprText } from '@/core/currency'
import type { BookingResponse, BookingStatus } from '@/core/api/models'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

const STATUS_ORDER: BookingStatus[] = ['RESERVED', 'PAYMENT_PENDING', 'COMPLETED', 'EXPIRED', 'REJECTED']

const statusVariant: Record<BookingStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  RESERVED: 'default',
  PAYMENT_PENDING: 'secondary',
  COMPLETED: 'default',
  EXPIRED: 'outline',
  REJECTED: 'destructive',
}

function sortBookings(bookings: BookingResponse[]): BookingResponse[] {
  return [...bookings].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  )
}

function canEdit(b: BookingResponse): boolean {
  return b.status === 'RESERVED' || b.status === 'PAYMENT_PENDING' || b.status === 'COMPLETED'
}

export default function MyBookingsPage() {
  const [searchParams] = useSearchParams()
  const notice = searchParams.get('notice')
  const queryClient = useQueryClient()

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings', 'mine'],
    queryFn: bookingsApi.myBookings,
  })

  const uploadMutation = useMutation({
    mutationFn: ({ bookingId, file }: { bookingId: string; file: File }) =>
      bookingsApi.uploadPaymentProof(bookingId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', 'mine'] })
      toast.success('Payment proof uploaded')
    },
    onError: () => toast.error('Upload failed'),
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetRef = useRef<string | null>(null)

  const handleUpload = (bookingId: string) => {
    uploadTargetRef.current = bookingId
    fileInputRef.current?.click()
  }

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && uploadTargetRef.current) {
      uploadMutation.mutate({ bookingId: uploadTargetRef.current, file })
    }
    e.target.value = ''
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    )
  }

  const sorted = sortBookings(bookings ?? [])

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">My Bookings</h1>

      {notice === 'one-booking' && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You already have an active booking. Edit it or wait until it expires.
        </div>
      )}

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No bookings yet.</p>
            <Button asChild className="mt-4">
              <Link to="/app/book">Book a Seat</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sorted.map((b) => (
            <Card key={b.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">
                  Seat {b.seat_id} — {b.start_date} to {b.end_date}
                </CardTitle>
                <Badge variant={statusVariant[b.status]}>{b.status.replace('_', ' ')}</Badge>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div><span className="text-muted-foreground">Access:</span> {b.access_type}</div>
                  <div><span className="text-muted-foreground">Time:</span> {b.start_time}–{b.end_time}</div>
                  <div><span className="text-muted-foreground">Total:</span> {nprText(b.final_price)}</div>
                  <div><span className="text-muted-foreground">Due:</span> {nprText(b.amount_due)}</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {canEdit(b) && (
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/app/bookings/${b.id}/edit`}>Edit</Link>
                    </Button>
                  )}
                  {(b.status === 'RESERVED' || b.status === 'PAYMENT_PENDING') && (
                    <Button variant="outline" size="sm" onClick={() => handleUpload(b.id)}>
                      Upload Payment Proof
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileSelected} />
    </div>
  )
}
