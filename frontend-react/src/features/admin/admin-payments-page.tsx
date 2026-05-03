import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as adminBookingsApi from '@/core/api/admin-bookings'
import { nprText } from '@/core/currency'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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

  if (isLoading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Pending Payments</h1>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Seat</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings?.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center">No pending payments</TableCell></TableRow>
            ) : (
              bookings?.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="text-sm">{b.user?.email ?? b.user_id.slice(0, 8)}</TableCell>
                  <TableCell>{b.seat_id}</TableCell>
                  <TableCell>{nprText(b.final_price)}</TableCell>
                  <TableCell>{nprText(b.paid_amount)}</TableCell>
                  <TableCell>{nprText(b.amount_due)}</TableCell>
                  <TableCell><Badge variant="secondary">{b.status.replace('_', ' ')}</Badge></TableCell>
                  <TableCell>
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
