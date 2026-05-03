import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import * as dashboardApi from '@/core/api/admin-dashboard'
import { nprText } from '@/core/currency'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CalendarDays, Users, DollarSign, Grid3X3,
  TrendingUp, Clock, Image, ArrowRight, Activity,
} from 'lucide-react'

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  reserved: 'default',
  payment_pending: 'secondary',
  completed: 'default',
  expired: 'outline',
  rejected: 'destructive',
}

const statusColor: Record<string, string> = {
  reserved: 'bg-[#10B981]',
  payment_pending: 'bg-amber-400',
  completed: 'bg-emerald-500',
  expired: 'bg-slate-300',
  rejected: 'bg-red-500',
}

export default function AdminDashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: dashboardApi.getDashboardStats,
    refetchInterval: 30000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (!stats) return null

  const occupancyPct = Math.round((stats.enabled_seats / Math.max(stats.total_seats, 1)) * 100)

  const metrics = [
    {
      title: 'Total Bookings',
      value: stats.total_bookings,
      icon: CalendarDays,
      gradient: 'from-[#122C6B] to-[#2E4FA3]',
      link: '/admin/bookings',
    },
    {
      title: 'Revenue Collected',
      value: nprText(stats.total_revenue),
      icon: DollarSign,
      gradient: 'from-emerald-600 to-emerald-500',
      link: '/admin/payments',
    },
    {
      title: 'Pending Revenue',
      value: nprText(stats.pending_revenue),
      icon: TrendingUp,
      gradient: 'from-[#10B981] to-[#34D399]',
      link: '/admin/payments',
    },
    {
      title: 'Unique Users',
      value: stats.unique_users,
      icon: Users,
      gradient: 'from-[#0B1C45] to-[#122C6B]',
      link: '/admin/users',
    },
  ]

  const secondaryMetrics = [
    {
      title: 'Active Seats',
      value: `${stats.enabled_seats} / ${stats.total_seats}`,
      icon: Grid3X3,
      link: '/admin/seats',
    },
    {
      title: 'Pending Payments',
      value: stats.status_counts['payment_pending'] ?? 0,
      icon: Clock,
      link: '/admin/payments',
    },
    {
      title: 'Gallery Images',
      value: stats.gallery_count,
      icon: Image,
      link: '/admin/gallery',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header banner — navy → violet gradient */}
      <div className="rounded-xl bg-gradient-to-r from-[#122C6B] to-[#10B981] px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Dashboard</h1>
            <p className="text-sm text-white/60">Overview of your study room business</p>
          </div>
        </div>
      </div>

      {/* Primary metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Link key={m.title} to={m.link} className="group">
            <Card className="overflow-hidden border-0 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
              <CardContent className="p-0">
                <div className={`bg-gradient-to-br ${m.gradient} px-5 py-4`}>
                  <div className="flex items-center justify-between">
                    <m.icon className="h-5 w-5 text-white/80" />
                    <ArrowRight className="h-4 w-4 text-white/40 transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <p className="mt-3 text-2xl font-bold tracking-tight text-white">{m.value}</p>
                  <p className="mt-0.5 text-xs font-medium text-white/70">{m.title}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Secondary row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Quick Stats */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-0">
            {secondaryMetrics.map((m) => (
              <Link
                key={m.title}
                to={m.link}
                className="group flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/60"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#10B981]/10">
                    <m.icon className="h-4 w-4 text-[#10B981]" />
                  </div>
                  <span className="text-sm text-foreground">{m.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">{m.value}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/0 transition-all group-hover:text-muted-foreground/60" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Booking Status Breakdown */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Booking Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {Object.entries(stats.status_counts)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => {
                const pct = stats.total_bookings > 0
                  ? Math.round((count / stats.total_bookings) * 100)
                  : 0
                return (
                  <div key={status} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusColor[status] ?? 'bg-slate-400'}`} />
                        <span className="text-sm capitalize text-foreground">{status.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                        <span className="text-sm font-semibold tabular-nums">{count}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/60">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${statusColor[status] ?? 'bg-slate-400'}`}
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </CardContent>
        </Card>

        {/* Seat Occupancy */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Seat Occupancy</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-4">
            <div className="relative flex h-36 w-36 items-center justify-center">
              <svg viewBox="0 0 36 36" className="h-36 w-36 -rotate-90">
                <circle
                  cx="18" cy="18" r="15.9"
                  fill="none" stroke="currentColor" strokeWidth="2.5"
                  className="text-muted/20"
                />
                <circle
                  cx="18" cy="18" r="15.9"
                  fill="none" stroke="url(#occupancy-gradient)" strokeWidth="2.5"
                  strokeDasharray={`${occupancyPct} 100`}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
                <defs>
                  <linearGradient id="occupancy-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#122C6B" />
                    <stop offset="100%" stopColor="#10B981" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute text-center">
                <p className="text-3xl font-bold text-foreground">{occupancyPct}%</p>
                <p className="text-[11px] text-muted-foreground">{stats.enabled_seats} of {stats.total_seats}</p>
              </div>
            </div>
            <p className="mt-3 text-sm font-medium text-muted-foreground">Active seats</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent bookings */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent Bookings</CardTitle>
          <Link
            to="/admin/bookings"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#10B981] transition-colors hover:bg-[#10B981]/5"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          {stats.recent_bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">No bookings yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">User</th>
                    <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seat</th>
                    <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dates</th>
                    <th className="pb-3 pr-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_bookings.map((b, i) => (
                    <tr
                      key={b.id}
                      className={`transition-colors hover:bg-muted/30 ${i < stats.recent_bookings.length - 1 ? 'border-b border-border/30' : ''}`}
                    >
                      <td className="py-3 pr-4 font-medium">
                        {b.user
                          ? `${b.user.given_name ?? ''} ${b.user.family_name ?? ''}`.trim() || b.user.email
                          : <span className="text-muted-foreground">Unknown</span>}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex h-6 w-8 items-center justify-center rounded bg-[#10B981]/10 text-xs font-semibold text-[#10B981]">
                          S{b.seat_id}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {b.start_date} <span className="text-muted-foreground/40">&rarr;</span> {b.end_date}
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold tabular-nums">{nprText(b.final_price)}</td>
                      <td className="py-3">
                        <Badge variant={statusVariant[b.status] ?? 'outline'} className="capitalize text-[11px]">
                          {b.status.replace('_', ' ')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
