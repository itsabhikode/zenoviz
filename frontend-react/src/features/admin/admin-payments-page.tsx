import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as adminBookingsApi from '@/core/api/admin-bookings'
import type { BookingResponse } from '@/core/api/models'
import { nprText } from '@/core/currency'
import { DataTable } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { Check, X, Eye } from 'lucide-react'

export default function AdminPaymentsPage() {
  const queryClient = useQueryClient()

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['admin', 'payments', 'pending'],
    queryFn: adminBookingsApi.pendingPayments,
  })

  const approveMutation = useMutation({
    mutationFn: ({ bookingId, amount }: { bookingId: string; amount?: number }) =>
      adminBookingsApi.approvePayment(bookingId, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] })
      toast.success('Payment approved')
    },
    onError: (err) => {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? 'Approval failed' : 'Approval failed'
      toast.error(msg)
    },
  })

  const rejectMutation = useMutation({
    mutationFn: adminBookingsApi.rejectPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] })
      toast.success('Payment rejected')
    },
    onError: () => toast.error('Rejection failed'),
  })

  const [proofUrl, setProofUrl] = useState<string | null>(null)

  const viewProof = async (bookingId: string) => {
    try {
      const blob = await adminBookingsApi.downloadPaymentProof(bookingId)
      const url = URL.createObjectURL(blob)
      setProofUrl(url)
    } catch {
      toast.error('Could not load payment proof')
    }
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
      id: 'total',
      header: 'Total',
      accessorFn: (row) => Number.parseFloat(row.final_price),
      cell: ({ row }) => nprText(row.original.final_price),
    },
    {
      id: 'paid',
      header: 'Paid',
      accessorFn: (row) => Number.parseFloat(row.paid_amount),
      cell: ({ row }) => nprText(row.original.paid_amount),
    },
    {
      id: 'due',
      header: 'Due',
      accessorFn: (row) => Number.parseFloat(row.amount_due),
      cell: ({ row }) => (
        <span className="font-medium">{nprText(row.original.amount_due)}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.status.replace('_', ' ')}</Badge>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const b = row.original
        return (
          <div className="flex gap-1">
            {b.payment_proof_path && (
              <Button variant="ghost" size="icon" onClick={() => viewProof(b.id)} title="View proof">
                <Eye className="h-4 w-4" />
              </Button>
            )}
            <ApproveDialog
              amountDue={b.amount_due}
              onApprove={(amt) => approveMutation.mutate({ bookingId: b.id, amount: amt })}
            />
            <Button variant="ghost" size="icon" onClick={() => rejectMutation.mutate(b.id)} title="Reject">
              <X className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )
      },
    },
  ]

  if (isLoading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Pending Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review and approve payment submissions</p>
      </div>

      <DataTable columns={columns} data={bookings ?? []} emptyMessage="No pending payments" />

      {proofUrl && (
        <Dialog open onOpenChange={() => { URL.revokeObjectURL(proofUrl); setProofUrl(null) }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Payment Proof</DialogTitle></DialogHeader>
            <img src={proofUrl} alt="Payment proof" className="w-full rounded" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function ApproveDialog({ amountDue, onApprove }: { amountDue: string; onApprove: (amount?: number) => void }) {
  const [amount, setAmount] = useState('')

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Approve">
          <Check className="h-4 w-4 text-green-600" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Approve Payment</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Amount due: {nprText(amountDue)}</p>
          <div className="space-y-2">
            <Label>Amount (leave empty for full amount)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={amountDue} />
          </div>
          <Button className="w-full" onClick={() => onApprove(amount ? Number.parseFloat(amount) : undefined)}>
            Approve
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
