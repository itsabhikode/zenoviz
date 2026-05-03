import { useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as adminUsersApi from '@/core/api/admin-users'
import type { UserAdminSummary } from '@/core/api/models'
import { DataTable } from '@/components/data-table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Search } from 'lucide-react'

export default function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [emailPrefix, setEmailPrefix] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', emailPrefix],
    queryFn: () => adminUsersApi.listUsers({ limit: 50, email_prefix: emailPrefix || undefined }),
  })

  const grantMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      adminUsersApi.grantRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('Role granted')
    },
    onError: () => toast.error('Failed to grant role'),
  })

  const revokeMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      adminUsersApi.revokeRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('Role revoked')
    },
    onError: () => toast.error('Failed to revoke role'),
  })

  const columns: ColumnDef<UserAdminSummary>[] = [
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.email}</span>,
    },
    {
      id: 'name',
      header: 'Name',
      accessorFn: (row) => [row.given_name, row.family_name].filter(Boolean).join(' ') || '\u2014',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.enabled ? 'default' : 'destructive'}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: 'roles',
      header: 'Roles',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.roles.map((r) => (
            <Badge
              key={r}
              variant="secondary"
              className="cursor-pointer hover:bg-destructive/10 hover:text-destructive"
              onClick={() => revokeMutation.mutate({ userId: row.original.user_id, role: r })}
            >
              {r} &times;
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <RoleGrantDialog onGrant={(role) => grantMutation.mutate({ userId: row.original.user_id, role })} />
      ),
    },
  ]

  if (isLoading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage user accounts and roles</p>
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setEmailPrefix(searchInput)}
          />
        </div>
        <Button onClick={() => setEmailPrefix(searchInput)}>Search</Button>
      </div>

      <DataTable columns={columns} data={data?.users ?? []} emptyMessage="No users found" />
    </div>
  )
}

function RoleGrantDialog({ onGrant }: { onGrant: (role: string) => void }) {
  const [role, setRole] = useState('')
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Add role</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Grant role</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Select onValueChange={setRole}>
            <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">admin</SelectItem>
              <SelectItem value="user">user</SelectItem>
            </SelectContent>
          </Select>
          <Button className="w-full" disabled={!role} onClick={() => { onGrant(role); setRole('') }}>
            Grant
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
