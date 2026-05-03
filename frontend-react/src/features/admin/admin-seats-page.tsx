import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as adminSeatsApi from '@/core/api/admin-seats'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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

  if (isLoading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Seats</h1>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {seats?.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.id}</TableCell>
                <TableCell>{s.label}</TableCell>
                <TableCell>
                  <Badge variant={s.is_enabled ? 'default' : 'destructive'}>
                    {s.is_enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleMutation.mutate({ seatId: s.id, enabled: !s.is_enabled })}
                    disabled={toggleMutation.isPending}
                  >
                    {s.is_enabled ? 'Disable' : 'Enable'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
