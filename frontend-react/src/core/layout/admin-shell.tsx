import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router'
import { PageTransition } from '@/components/page-transition'
import { useAuth } from '@/core/auth/auth-context'
import { Button } from '@/components/ui/button'
import {
  Users, Shield, DollarSign, Grid3X3, CalendarDays,
  CreditCard, Settings, Image, LogOut, Menu, X, ArrowLeft, LayoutDashboard,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/roles', label: 'Roles', icon: Shield },
  { to: '/admin/pricing', label: 'Pricing', icon: DollarSign },
  { to: '/admin/seats', label: 'Seats', icon: Grid3X3 },
  { to: '/admin/bookings', label: 'Bookings', icon: CalendarDays },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/payment-settings', label: 'Pay Settings', icon: Settings },
  { to: '/admin/gallery', label: 'Gallery', icon: Image },
]

function sidebarLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150',
    isActive
      ? 'bg-white/15 text-white'
      : 'text-[#94A3B8] hover:bg-white/10 hover:text-white',
  )
}

export default function AdminShell() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const sidebar = (
    <nav className="flex flex-col gap-0.5 p-4">
      {/* Logo */}
      <div className="mb-6 flex items-center gap-2 px-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <span className="text-sm font-bold text-white">Z</span>
        </div>
        <span className="text-base font-semibold text-white">Admin</span>
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

      <div className="my-4 border-t border-white/10" />

      <NavLink
        to="/app/my-bookings"
        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[#94A3B8] transition-colors hover:bg-white/10 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to App
      </NavLink>
      <button
        onClick={() => { logout(); navigate('/login') }}
        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-[#94A3B8] transition-colors hover:bg-white/10 hover:text-red-400"
      >
        <LogOut className="h-4 w-4" /> Logout
      </button>
    </nav>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="nav-hubspot sticky top-0 z-50 flex items-center px-4 py-3 lg:hidden">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <span className="ml-2 text-lg font-semibold text-white">Admin</span>
      </header>

      <div className="flex">
        {/* Desktop sidebar — dark navy */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-0 h-screen overflow-y-auto bg-[#122C6B]">
            {sidebar}
          </div>
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close sidebar"
              className="absolute inset-0 bg-black/50"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="relative w-60 bg-[#122C6B] shadow-2xl">
              {sidebar}
            </aside>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 p-8">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  )
}
