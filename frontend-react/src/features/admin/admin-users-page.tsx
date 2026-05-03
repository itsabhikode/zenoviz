import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as adminUsersApi from '@/core/api/admin-users'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Users</h1>

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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="py-8 text-center">Loading...</TableCell></TableRow>
            ) : data?.users.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-8 text-center">No users found</TableCell></TableRow>
            ) : (
              data?.users.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-mono text-sm">{u.email}</TableCell>
                  <TableCell>{[u.given_name, u.family_name].filter(Boolean).join(' ') || '\u2014'}</TableCell>
                  <TableCell>
                    <Badge variant={u.enabled ? 'default' : 'destructive'}>
                      {u.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r} variant="secondary" className="cursor-pointer" onClick={() => revokeMutation.mutate({ userId: u.user_id, role: r })}>
                          {r} &times;
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <RoleGrantDialog onGrant={(role) => grantMutation.mutate({ userId: u.user_id, role })} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
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
