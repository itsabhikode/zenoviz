# Angular → React Migration Design

**Date:** 2026-05-03  
**Status:** Approved  
**Scope:** Replace Angular 19 frontend with React 19 + shadcn/ui in a new `frontend-react/` directory (side-by-side, cut over when ready)

---

## Overview

Migrate the Zenoviz frontend from Angular 19 + Angular Material to React 19 + shadcn/ui + Tailwind v4. Goal: modern SaaS aesthetic (Stripe/Linear style), full feature parity, same FastAPI backend. Angular `frontend/` stays intact until React version is production-ready.

---

## Tech Stack

| Concern | Choice |
|---------|--------|
| Framework | React 19 |
| Build | Vite 6 |
| Routing | React Router v7 |
| UI components | shadcn/ui (latest) |
| Styling | Tailwind CSS v4 |
| Server state | TanStack Query v5 |
| Auth state | React Context |
| HTTP | axios |
| Forms | react-hook-form + zod |
| Date picker | react-day-picker v9 |
| Language | TypeScript (strict) |

---

## Folder Structure

```
frontend-react/
  src/
    core/
      api/          # One file per backend router + shared models.ts
      auth/         # AuthContext, useAuth, token storage, Cognito OAuth helpers
      layout/       # UserShell, AdminShell
    features/
      auth/         # LoginPage, RegisterPage, ForgotPasswordPage, OAuthCallbackPage
      bookings/     # MyBookingsPage, CreateBookingPage, EditBookingPage, SeatGrid
      admin/        # AdminUsersPage, AdminRolesPage, AdminPricingPage,
                    # AdminSeatsPage, AdminBookingsPage, AdminPaymentsPage,
                    # AdminPaymentSettingsPage
    components/
      ui/           # shadcn/ui generated components
    lib/
      utils.ts      # cn() helper
      query.ts      # TanStack Query client
    App.tsx         # Router tree + providers
    main.tsx
```

---

## Routes

Exact parity with current Angular routes:

| Path | Component | Guard |
|------|-----------|-------|
| `/login` | LoginPage | — |
| `/register` | RegisterPage | — |
| `/forgot-password` | ForgotPasswordPage | — |
| `/auth/callback` | OAuthCallbackPage | — |
| `/app/my-bookings` | MyBookingsPage | auth |
| `/app/book` | CreateBookingPage | auth + bookRouteGuard (blocks if user has active RESERVED/PAYMENT_PENDING booking — redirects to `/app/my-bookings?notice=one-booking`) |
| `/app/bookings/:id/edit` | EditBookingPage | auth |
| `/admin/users` | AdminUsersPage | auth + admin |
| `/admin/roles` | AdminRolesPage | auth + admin |
| `/admin/pricing` | AdminPricingPage | auth + admin |
| `/admin/seats` | AdminSeatsPage | auth + admin |
| `/admin/bookings` | AdminBookingsPage | auth + admin |
| `/admin/payments` | AdminPaymentsPage | auth + admin |
| `/admin/payment-settings` | AdminPaymentSettingsPage | auth + admin |
| `/` | redirect → `/login` | — |

Guards implemented as `<ProtectedRoute>` and `<AdminRoute>` wrapper components.

---

## Architecture

### Auth

- `AuthContext` shape: `{ user: MeResponse | null, isAdmin: boolean, login, logout, isLoading }`
- Login flow: POST `/auth/login` → store tokens in localStorage → GET `/auth/me` → set user in context
- Cognito OAuth: `startGoogleOAuth()` helper redirects to Cognito; `OAuthCallbackPage` exchanges code for tokens, sets context, redirects
- axios interceptor: injects `Authorization: Bearer <access_token>` on every request; on 401 response, clears localStorage + redirects to `/login?returnTo=<current-path>`
- Token refresh: POST `/auth/refresh` using refresh_token, update access_token in storage

### API Layer

One file per backend router, no business logic:

```
core/api/
  auth.ts          # login, register, forgotPassword, me, refresh, googleOAuth
  bookings.ts      # myBookings, createBooking, checkAvailability, seatsAvailability,
                   # publicPricing, editBooking, uploadPaymentProof
  admin-users.ts   # listUsers, getUser
  admin-roles.ts   # assignRole, removeRole, getUserRoles
  admin-bookings.ts
  admin-payments.ts
  admin-pricing.ts # getPricing, updatePricing
  admin-seats.ts   # listSeats, updateSeatEnabled
  models.ts        # All TypeScript interfaces (direct port of Angular models.ts)
```

All functions return `Promise<T>` via axios. No RxJS.

### TanStack Query

Query hooks co-located with feature pages:

```ts
// Example
export function useMyBookings() {
  return useQuery({ queryKey: ['bookings', 'mine'], queryFn: api.myBookings });
}
export function useCreateBooking() {
  return useMutation({
    mutationFn: api.createBooking,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings', 'mine'] }),
  });
}
```

Query key conventions:
- `['bookings', 'mine']` — user's bookings
- `['bookings', 'availability', params]` — seat availability check
- `['seats', 'availability', params]` — seats map
- `['admin', 'users']`, `['admin', 'bookings']`, etc.
- `['pricing', 'public']` — public pricing (used on login page, no auth)

### Layouts

**UserShell:** Top navbar — logo left, nav links center (`My Bookings`, `Book a Seat`), user dropdown right (email + logout). No sidebar (only 2 user pages).

**AdminShell:** Fixed left sidebar (240px) with icon+label nav items grouped by section. Collapsible on mobile. Top bar shows current page title + breadcrumb.

---

## UI Design System

### Palette

```
Brand:   violet-600 (#7c3aed) — accent, CTAs, active states
Neutral: slate scale — text, borders, backgrounds
Success: green-600
Warning: amber-600
Error:   red-600
Surface: white / slate-50
```

Tailwind CSS v4 config defines `--brand` CSS var as violet-600. shadcn/ui configured with `violet` as primary.

### shadcn/ui Components

| Component | Used for |
|-----------|----------|
| Button | All CTAs |
| Input / Label | All form fields |
| Card | Content containers |
| Badge | Status chips (RESERVED, COMPLETED, etc.) |
| Checkbox | Locker add-on toggle |
| RadioGroup | Access type selector (timeslot / anytime) |
| Table + DataTable | All admin list pages |
| Dialog | Confirm modals, edit modals |
| Sonner (toast) | Success/error notifications |
| Skeleton | Loading states |
| Separator | Section dividers |
| DropdownMenu | User menu in navbar |
| Tabs | Admin pages with multiple views |
| Select | Dropdowns (role selector, etc.) |
| DatePicker | Custom — built on shadcn Popover + react-day-picker |

### Key Page Notes

**Login:** Keep split-screen hero layout — violet gradient left with pricing banner, form card right. Mobile: hero-first, "Book now" reveals form (same behaviour as current). Port directly to Tailwind + shadcn Input/Button.

**CreateBooking:** Most complex page.
- Date range: two `DatePicker` fields (react-day-picker under the hood)
- Access type: `RadioGroup` (timeslot / anytime)
- Time slot picker: custom chip grid (same as current — CSS grid, no library)
- Seat map: `SeatGrid` — custom component, 65 seats, available/unavailable/selected/disabled states via CSS classes
- Invoice: Card with breakdown lines + total (same structure as current)
- All reactive via `useState` + `useEffect` + TanStack Query `enabled` flag

**Admin tables:** shadcn DataTable with column defs, client-side sorting, pagination. Booking status shown as colour-coded `Badge`.

---

## Error Handling

- **Network errors:** axios interceptor catches 401 globally (logout + redirect). Other errors bubble to query hooks → shown via Sonner toast or inline form error.
- **Form validation:** react-hook-form + zod schemas on all forms. Field-level errors shown inline below inputs.
- **Booking conflicts:** availability check returns `available: false` with `reason` — shown as inline warning in invoice section.

---

## Testing

- Unit tests: Vitest + React Testing Library
- Test files mirror src structure: `src/features/auth/__tests__/LoginPage.test.tsx`
- Test each page: renders, form validation, API call on submit, error state
- Auth context tested in isolation with mock provider
- No e2e in scope for this migration (backend already tested)

---

## Out of Scope

- Dark mode
- i18n
- SSR / Next.js
- Backend changes
- Removing Angular `frontend/` (done manually after cutover)
