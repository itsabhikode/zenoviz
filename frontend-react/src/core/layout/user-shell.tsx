import { Outlet, NavLink, useNavigate } from 'react-router'
import { useAuth } from '@/core/auth/auth-context'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CalendarDays, Plus, User, LogOut } from 'lucide-react'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? 'bg-primary/10 text-primary'
      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
  }`
}

export default function UserShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const displayName = (() => {
    if (!user) return '—'
    const given = (user.given_name ?? '').trim()
    const family = (user.family_name ?? '').trim()
    const full = `${given} ${family}`.trim()
    if (full) return full
    if (user.email) return user.email
    return user.user_id.slice(0, 8)
  })()

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="text-lg font-bold tracking-tight text-primary">Zenoviz</span>
          <nav className="flex items-center gap-1">
            <NavLink to="/app/my-bookings" className={navLinkClass}>
              <CalendarDays className="h-4 w-4" /> My Bookings
            </NavLink>
            <NavLink to="/app/book" className={navLinkClass}>
              <Plus className="h-4 w-4" /> Book a Seat
            </NavLink>
          </nav>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">{displayName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                {user?.email}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { logout(); navigate('/login') }}>
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
