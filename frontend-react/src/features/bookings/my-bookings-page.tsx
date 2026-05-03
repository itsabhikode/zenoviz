import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, Link } from 'react-router'
import * as bookingsApi from '@/core/api/bookings'
import { nprText } from '@/core/currency'
import type { BookingResponse, BookingStatus, PaymentSettingsResponse } from '@/core/api/models'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StaggerList, StaggerItem } from '@/components/stagger-list'
import { QrCode, Copy } from 'lucide-react'
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

function usePaymentQr(settings: PaymentSettingsResponse | undefined) {
  const [qrUrl, setQrUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!settings?.has_qr) { setQrUrl(null); return }
    const pub = settings.qr_public_url?.trim()
    if (pub) {
      const sep = pub.includes('?') ? '&' : '?'
      const bust = settings.updated_at ? `${sep}v=${encodeURIComponent(settings.updated_at)}` : ''
      setQrUrl(pub + bust)
      return
    }
    let revoked = false
    bookingsApi.paymentQrBlob().then((blob) => {
      if (!revoked) setQrUrl(URL.createObjectURL(blob))
    }).catch(() => setQrUrl(null))
    return () => { revoked = true }
  }, [settings])

  useEffect(() => {
    return () => { if (qrUrl?.startsWith('blob:')) URL.revokeObjectURL(qrUrl) }
  }, [qrUrl])

  return qrUrl
}

export default function MyBookingsPage() {
  const [searchParams] = useSearchParams()
  const notice = searchParams.get('notice')
  const queryClient = useQueryClient()

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings', 'mine'],
    queryFn: bookingsApi.myBookings,
  })

  const needsPayment = (bookings ?? []).some(
    (b) => b.status === 'RESERVED' || b.status === 'PAYMENT_PENDING',
  )

  const { data: settings } = useQuery({
    queryKey: ['payment-settings'],
    queryFn: bookingsApi.paymentSettings,
    enabled: needsPayment,
  })

  const qrUrl = usePaymentQr(needsPayment ? settings : undefined)

  const showPaymentCard = needsPayment && settings &&
    (settings.has_qr || !!settings.upi_vpa || !!settings.payee_name || !!settings.instructions)

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
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">My Bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your study room reservations</p>
      </div>

      {showPaymentCard && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <QrCode className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Pay for your reservation</CardTitle>
              <p className="text-sm text-muted-foreground">
                Scan the payment QR, pay as instructed, then upload the screenshot on your booking card below.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt="Payment QR"
                  className="w-[min(220px,70vw)] rounded-xl bg-white object-contain p-2.5 shadow-sm"
                />
              ) : settings?.has_qr ? (
                <div className="flex w-[min(220px,70vw)] flex-col items-center gap-2 rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                  <QrCode className="h-12 w-12" />
                  <span>Loading QR...</span>
                </div>
              ) : (
                <div className="flex w-[min(220px,70vw)] flex-col items-center gap-2 rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                  <QrCode className="h-12 w-12" />
                  <span>No QR uploaded yet</span>
                </div>
              )}
              <div className="space-y-2 text-sm">
                {settings?.payee_name && (
                  <div><span className="text-muted-foreground">Payee:</span> <strong>{settings.payee_name}</strong></div>
                )}
                {settings?.upi_vpa && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">UPI/ID:</span> <strong>{settings.upi_vpa}</strong>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        navigator.clipboard.writeText(settings.upi_vpa!)
                        toast.success('Copied to clipboard')
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {settings?.instructions && (
                  <div className="whitespace-pre-wrap text-muted-foreground">{settings.instructions}</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
        <StaggerList className="space-y-4">
          {sorted.map((b) => (
            <StaggerItem key={b.id}>
            <Card className="overflow-hidden border-border/60 shadow-sm transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between bg-muted/30 pb-2">
                <CardTitle className="text-base font-semibold">
                  Seat {b.seat_id} &middot; {b.start_date} &rarr; {b.end_date}
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
            </StaggerItem>
          ))}
        </StaggerList>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileSelected} />
    </div>
  )
}
