import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Command } from 'cmdk'
import { useAuth } from '@/core/auth/auth-context'
import {
  CalendarDays, Plus, Users, Shield, DollarSign,
  Grid3X3, CreditCard, Settings, Image, LogOut, Search, LayoutDashboard,
} from 'lucide-react'

interface CommandItem {
  label: string
  icon: React.ElementType
  to?: string
  action?: () => void
  admin?: boolean
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { isAdmin, logout } = useAuth()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const go = (item: CommandItem) => {
    setOpen(false)
    if (item.to) navigate(item.to)
    if (item.action) item.action()
  }

  const items: CommandItem[] = [
    { label: 'My Bookings', icon: CalendarDays, to: '/app/my-bookings' },
    { label: 'Book a Seat', icon: Plus, to: '/app/book' },
    { label: 'Dashboard', icon: LayoutDashboard, to: '/admin/dashboard', admin: true },
    { label: 'Users', icon: Users, to: '/admin/users', admin: true },
    { label: 'Roles', icon: Shield, to: '/admin/roles', admin: true },
    { label: 'Pricing', icon: DollarSign, to: '/admin/pricing', admin: true },
    { label: 'Seats', icon: Grid3X3, to: '/admin/seats', admin: true },
    { label: 'Bookings', icon: CalendarDays, to: '/admin/bookings', admin: true },
    { label: 'Payments', icon: CreditCard, to: '/admin/payments', admin: true },
    { label: 'Payment Settings', icon: Settings, to: '/admin/payment-settings', admin: true },
    { label: 'Gallery', icon: Image, to: '/admin/gallery', admin: true },
    { label: 'Logout', icon: LogOut, action: () => { logout(); navigate('/login') } },
  ]

  const filtered = items.filter((i) => !i.admin || isAdmin)
  const userItems = filtered.filter((i) => !i.admin)
  const adminItems = filtered.filter((i) => i.admin)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Dialog */}
      <div className="relative mx-auto mt-[20vh] w-full max-w-lg px-4">
        <Command
          className="overflow-hidden rounded-lg border border-border/60 bg-white shadow-2xl"
          loop
        >
          <div className="flex items-center gap-2 border-b border-border/40 px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              placeholder="Search pages..."
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            <kbd className="hidden shrink-0 rounded border border-border/60 bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            <Command.Group heading="Navigation" className="text-xs font-medium text-muted-foreground px-2 py-1.5">
              {userItems.map((item) => (
                <Command.Item
                  key={item.label}
                  value={item.label}
                  onSelect={() => go(item)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                >
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>

            {adminItems.length > 0 && (
              <Command.Group heading="Admin" className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                {adminItems.map((item) => (
                  <Command.Item
                    key={item.label}
                    value={`Admin ${item.label}`}
                    onSelect={() => go(item)}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    {item.label}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
