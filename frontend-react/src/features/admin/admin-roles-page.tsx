import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as adminRolesApi from '@/core/api/admin-roles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'

export default function AdminRolesPage() {
  const queryClient = useQueryClient()
  const [identifier, setIdentifier] = useState('')
  const [role, setRole] = useState('')
  const [useEmail, setUseEmail] = useState(true)

  const grantMutation = useMutation({
    mutationFn: adminRolesApi.grantRole,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      toast.success(res.changed ? 'Role granted' : 'User already has this role')
    },
    onError: (err) => {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? 'Failed' : 'Failed'
      toast.error(msg)
    },
  })

  const revokeMutation = useMutation({
    mutationFn: adminRolesApi.revokeRole,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      toast.success(res.changed ? 'Role revoked' : 'User did not have this role')
    },
    onError: (err) => {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? 'Failed' : 'Failed'
      toast.error(msg)
    },
  })

  const buildBody = () => {
    const body: { email?: string; user_id?: string; role: string } = { role }
    if (useEmail) body.email = identifier
    else body.user_id = identifier
    return body
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Role Management</h1>

      <Card className="max-w-lg">
        <CardHeader><CardTitle className="text-base">Grant or Revoke Role</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button variant={useEmail ? 'default' : 'outline'} size="sm" onClick={() => setUseEmail(true)}>By email</Button>
            <Button variant={!useEmail ? 'default' : 'outline'} size="sm" onClick={() => setUseEmail(false)}>By user ID</Button>
          </div>

          <div className="space-y-2">
            <Label>{useEmail ? 'Email' : 'User ID'}</Label>
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={useEmail ? 'user@example.com' : 'user-uuid'}
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select onValueChange={setRole}>
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">admin</SelectItem>
                <SelectItem value="user">user</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={!identifier || !role || grantMutation.isPending}
              onClick={() => grantMutation.mutate(buildBody())}
            >
              Grant
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={!identifier || !role || revokeMutation.isPending}
              onClick={() => revokeMutation.mutate(buildBody())}
            >
              Revoke
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
