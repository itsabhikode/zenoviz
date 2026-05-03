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
  { to: '/admin/payment-settings', label: 'Payment Settings', icon: Settings },
]

function sidebarLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  )
}

export default function AdminShell() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const sidebar = (
    <nav className="flex flex-col gap-1 p-4">
      <span className="mb-4 text-lg font-bold tracking-tight text-primary">Zenoviz Admin</span>
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
      <div className="my-4 border-t" />
      <NavLink
        to="/app/my-bookings"
        className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to App
      </NavLink>
      <button
        onClick={() => { logout(); navigate('/login') }}
        className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <LogOut className="h-4 w-4" /> Logout
      </button>
    </nav>
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 flex items-center border-b bg-background px-4 py-3 lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <span className="ml-2 text-lg font-bold text-primary">Admin</span>
      </header>
      <div className="flex">
        <aside className="hidden w-60 shrink-0 border-r bg-card lg:block">
          <div className="sticky top-0 h-screen overflow-y-auto">{sidebar}</div>
        </aside>
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button type="button" aria-label="Close sidebar" className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
            <aside className="relative w-60 bg-card shadow-lg">{sidebar}</aside>
          </div>
        )}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
