import { Outlet, NavLink, useNavigate } from 'react-router'
import { useAuth } from '@/core/auth/auth-context'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CalendarDays, Plus, User, LogOut, Shield } from 'lucide-react'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
    isActive
      ? 'bg-primary/10 text-primary shadow-sm'
      : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
  }`
}

export default function UserShell() {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()

  const displayName = (() => {
    if (!user) return '\u2014'
    const given = (user.given_name ?? '').trim()
    const family = (user.family_name ?? '').trim()
    const full = `${given} ${family}`.trim()
    if (full) return full
    if (user.email) return user.email
    return user.user_id.slice(0, 8)
  })()

  return (
    <div className="min-h-screen bg-background">
      {/* Glass navbar */}
      <header className="nav-glass sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 shadow-sm">
              <span className="text-sm font-bold text-white">Z</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">Zenoviz</span>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            <NavLink to="/app/my-bookings" className={navLinkClass}>
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">My Bookings</span>
            </NavLink>
            <NavLink to="/app/book" className={navLinkClass}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Book a Seat</span>
            </NavLink>
          </nav>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 rounded-lg">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-3.5 w-3.5" />
                </div>
                <span className="hidden text-sm font-medium sm:inline">{displayName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              {isAdmin && (
                <DropdownMenuItem onClick={() => navigate('/admin')}>
                  <Shield className="mr-2 h-4 w-4" /> Admin Panel
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => { logout(); navigate('/login') }}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
