import { type ColumnDef } from '@tanstack/react-table'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as adminSeatsApi from '@/core/api/admin-seats'
import type { SeatResponse } from '@/core/api/models'
import { DataTable } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

export default function AdminSeatsPage() {
  const queryClient = useQueryClient()

  const { data: seats, isLoading } = useQuery({
    queryKey: ['admin', 'seats'],
    queryFn: adminSeatsApi.listSeats,
  })

  const toggleMutation = useMutation({
    mutationFn: ({ seatId, enabled }: { seatId: number; enabled: boolean }) =>
      adminSeatsApi.patchSeat(seatId, { is_enabled: enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'seats'] })
      toast.success('Seat updated')
    },
    onError: () => toast.error('Failed to update seat'),
  })

  const columns: ColumnDef<SeatResponse>[] = [
    {
      accessorKey: 'id',
      header: 'ID',
    },
    {
      accessorKey: 'label',
      header: 'Label',
    },
    {
      accessorKey: 'is_enabled',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.is_enabled ? 'default' : 'destructive'}>
          {row.original.is_enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => toggleMutation.mutate({ seatId: row.original.id, enabled: !row.original.is_enabled })}
          disabled={toggleMutation.isPending}
        >
          {row.original.is_enabled ? 'Disable' : 'Enable'}
        </Button>
      ),
    },
  ]

  if (isLoading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Seats</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enable or disable study room seats</p>
      </div>

      <DataTable columns={columns} data={seats ?? []} pageSize={20} emptyMessage="No seats configured" />
    </div>
  )
}
