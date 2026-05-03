import { Outlet, NavLink, useNavigate } from 'react-router'
import { useAuth } from '@/core/auth/auth-context'
import { PageTransition } from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CalendarDays, Plus, User, LogOut, Shield, Search } from 'lucide-react'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
    isActive
      ? 'bg-white/15 text-white'
      : 'text-[#94A3B8] hover:text-white hover:bg-white/10'
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
      {/* HubSpot-style dark navbar */}
      <header className="nav-hubspot sticky top-0 z-50">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-sm font-bold text-white">Z</span>
              </div>
              <span className="text-lg font-semibold text-white">Zenoviz</span>
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
          </div>

          <div className="flex items-center gap-3">
            {/* Search hint */}
            <button
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              className="hidden items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-xs text-[#94A3B8] hover:bg-white/15 hover:text-white md:flex"
            >
              <Search className="h-3.5 w-3.5" />
              Search
              <kbd className="ml-1 rounded border border-white/20 px-1 py-0.5 text-[10px]">⌘K</kbd>
            </button>

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 rounded-md text-[#94A3B8] hover:bg-white/10 hover:text-white">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white">
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
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
    </div>
  )
}
