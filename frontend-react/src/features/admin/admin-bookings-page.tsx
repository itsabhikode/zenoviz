import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as adminBookingsApi from '@/core/api/admin-bookings'
import type { BookingStatus } from '@/core/api/models'
import { nprText } from '@/core/currency'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

const STATUSES: (BookingStatus | 'ALL')[] = ['ALL', 'RESERVED', 'PAYMENT_PENDING', 'COMPLETED', 'EXPIRED', 'REJECTED']

const statusVariant: Record<BookingStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  RESERVED: 'default',
  PAYMENT_PENDING: 'secondary',
  COMPLETED: 'default',
  EXPIRED: 'outline',
  REJECTED: 'destructive',
}

export default function AdminBookingsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['admin', 'bookings', statusFilter],
    queryFn: () => adminBookingsApi.allBookings(statusFilter === 'ALL' ? undefined : statusFilter),
  })

  if (isLoading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">All Bookings</h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Seat</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-8 text-center">No bookings found</TableCell></TableRow>
            ) : (
              bookings?.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="text-sm">{b.user?.email ?? b.user_id.slice(0, 8)}</TableCell>
                  <TableCell>{b.seat_id}</TableCell>
                  <TableCell className="text-sm">{b.start_date} &rarr; {b.end_date}</TableCell>
                  <TableCell>{b.access_type}</TableCell>
                  <TableCell>{nprText(b.final_price)}</TableCell>
                  <TableCell><Badge variant={statusVariant[b.status]}>{b.status.replace('_', ' ')}</Badge></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
