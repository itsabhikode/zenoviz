import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router'
import { useAuth } from '@/core/auth/auth-context'
import { Button } from '@/components/ui/button'
import {
  Users, Shield, DollarSign, Grid3X3, CalendarDays,
  CreditCard, Settings, LogOut, Menu, X, ArrowLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/roles', label: 'Roles', icon: Shield },
  { to: '/admin/pricing', label: 'Pricing', icon: DollarSign },
  { to: '/admin/seats', label: 'Seats', icon: Grid3X3 },
  { to: '/admin/bookings', label: 'Bookings', icon: CalendarDays },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/payment-settings', label: 'Pay Settings', icon: Settings },
]

function sidebarLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
    isActive
      ? 'bg-white/90 text-violet-700 shadow-sm'
      : 'text-slate-500 hover:bg-white/50 hover:text-slate-700',
  )
}

export default function AdminShell() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const sidebar = (
    <nav className="flex flex-col gap-1 p-4">
      {/* Logo */}
      <div className="mb-6 flex items-center gap-2 px-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 shadow-sm">
          <span className="text-sm font-bold text-violet-700">Z</span>
        </div>
        <span className="text-base font-bold tracking-tight text-slate-700">Admin</span>
      </div>

      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={sidebarLinkClass}
          onClick={() => setSidebarOpen(false)}
        >
          <item.icon className="h-4 w-4" /> {item.label}
        </NavLink>
      ))}

      <div className="my-4 border-t border-slate-200/50" />

      <NavLink
        to="/app/my-bookings"
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-white/50 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to App
      </NavLink>
      <button
        onClick={() => { logout(); navigate('/login') }}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-white/50 hover:text-red-600"
      >
        <LogOut className="h-4 w-4" /> Logout
      </button>
    </nav>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="nav-glass sticky top-0 z-50 flex items-center px-4 py-3 lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <span className="ml-2 text-lg font-bold text-foreground">Admin</span>
      </header>

      <div className="flex">
        {/* Desktop sidebar — subtle gradient */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-0 h-screen overflow-y-auto border-r border-border/50 bg-gradient-to-b from-slate-50 to-slate-100/80">
            {sidebar}
          </div>
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close sidebar"
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="relative w-64 bg-gradient-to-b from-slate-50 to-slate-100/80 shadow-2xl">
              {sidebar}
            </aside>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
