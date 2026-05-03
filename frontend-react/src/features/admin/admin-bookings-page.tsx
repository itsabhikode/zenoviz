import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import * as adminBookingsApi from '@/core/api/admin-bookings'
import type { BookingResponse, BookingStatus } from '@/core/api/models'
import { nprText } from '@/core/currency'
import { DataTable } from '@/components/data-table'
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

const columns: ColumnDef<BookingResponse>[] = [
  {
    id: 'user',
    header: 'User',
    accessorFn: (row) => row.user?.email ?? row.user_id.slice(0, 8),
    cell: ({ getValue }) => <span className="text-sm">{getValue() as string}</span>,
  },
  {
    accessorKey: 'seat_id',
    header: 'Seat',
  },
  {
    id: 'dates',
    header: 'Dates',
    accessorFn: (row) => row.start_date,
    cell: ({ row }) => (
      <span className="text-sm">{row.original.start_date} &rarr; {row.original.end_date}</span>
    ),
  },
  {
    accessorKey: 'access_type',
    header: 'Access',
  },
  {
    id: 'total',
    header: 'Total',
    accessorFn: (row) => Number.parseFloat(row.final_price),
    cell: ({ row }) => nprText(row.original.final_price),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={statusVariant[row.original.status]}>
        {row.original.status.replace('_', ' ')}
      </Badge>
    ),
  },
]

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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">All Bookings</h1>
          <p className="mt-1 text-sm text-muted-foreground">View and filter all reservations</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={bookings ?? []} emptyMessage="No bookings found" />
    </div>
  )
}
