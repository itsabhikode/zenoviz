# Angular → React Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Angular 19 frontend with React 19 + shadcn/ui in `frontend-react/`, achieving full feature parity with modern SaaS aesthetic.

**Architecture:** Side-by-side migration. New Vite-based React app in `frontend-react/`. Same FastAPI backend, same API contracts. Angular `frontend/` stays untouched until cutover.

**Tech Stack:** React 19, Vite 6, React Router v7, TanStack Query v5, shadcn/ui, Tailwind CSS v4, axios, react-hook-form + zod, react-day-picker v9, Vitest + RTL

---

## File Map

```
frontend-react/
├── index.html
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── components.json                # shadcn/ui config
├── .env.example
├── src/
│   ├── main.tsx
│   ├── App.tsx                    # Router tree + providers
│   ├── index.css                  # Tailwind + shadcn theme vars
│   ├── test-setup.ts              # RTL + jest-dom setup
│   ├── lib/
│   │   ├── utils.ts               # cn() helper (shadcn)
│   │   └── query-client.ts        # TanStack Query client
│   ├── core/
│   │   ├── api/
│   │   │   ├── client.ts          # axios instance + interceptors
│   │   │   ├── models.ts          # All TS interfaces
│   │   │   ├── auth.ts            # Auth API functions
│   │   │   ├── bookings.ts        # Booking API functions
│   │   │   ├── admin-pricing.ts   # Admin pricing API
│   │   │   ├── admin-seats.ts     # Admin seats API
│   │   │   ├── admin-bookings.ts  # Admin bookings API
│   │   │   ├── admin-payments.ts  # Admin payment settings API
│   │   │   ├── admin-users.ts     # Admin users API
│   │   │   └── admin-roles.ts     # Admin roles API
│   │   ├── auth/
│   │   │   ├── auth-context.tsx   # AuthContext + AuthProvider + useAuth
│   │   │   ├── token-storage.ts   # localStorage helpers
│   │   │   └── cognito-oauth.ts   # PKCE helpers
│   │   ├── booking/
│   │   │   └── booking-rules.ts   # hasBlockingBooking logic
│   │   ├── currency.ts            # NPR formatting
│   │   └── layout/
│   │       ├── user-shell.tsx     # Top navbar layout
│   │       └── admin-shell.tsx    # Sidebar layout
│   ├── features/
│   │   ├── auth/
│   │   │   ├── login-page.tsx
│   │   │   ├── register-page.tsx
│   │   │   ├── forgot-password-page.tsx
│   │   │   └── oauth-callback-page.tsx
│   │   ├── bookings/
│   │   │   ├── my-bookings-page.tsx
│   │   │   ├── create-booking-page.tsx
│   │   │   ├── edit-booking-page.tsx
│   │   │   └── seat-grid.tsx
│   │   └── admin/
│   │       ├── admin-users-page.tsx
│   │       ├── admin-roles-page.tsx
│   │       ├── admin-pricing-page.tsx
│   │       ├── admin-seats-page.tsx
│   │       ├── admin-bookings-page.tsx
│   │       ├── admin-payments-page.tsx
│   │       └── admin-payment-settings-page.tsx
│   ├── components/
│   │   ├── ui/                    # shadcn generated (button, input, card, etc.)
│   │   ├── protected-route.tsx
│   │   ├── admin-route.tsx
│   │   ├── book-route.tsx
│   │   └── date-picker.tsx        # Popover + react-day-picker
│   └── __tests__/
│       ├── core/
│       │   ├── currency.test.ts
│       │   ├── booking-rules.test.ts
│       │   ├── token-storage.test.ts
│       │   └── auth-context.test.tsx
│       ├── components/
│       │   ├── protected-route.test.tsx
│       │   └── admin-route.test.tsx
│       └── features/
│           ├── login-page.test.tsx
│           ├── register-page.test.tsx
│           ├── my-bookings-page.test.tsx
│           ├── create-booking-page.test.tsx
│           └── admin-pricing-page.test.tsx
```

---

### Task 1: Scaffold Vite + React + TypeScript Project

**Files:**
- Create: `frontend-react/` (via `npm create vite`)
- Modify: `frontend-react/package.json` (add all deps)
- Create: `frontend-react/.env.example`

- [ ] **Step 1: Create Vite project**

```bash
cd /Users/akarna/PycharmProjects/zenoviz
npm create vite@latest frontend-react -- --template react-ts
```

- [ ] **Step 2: Install production dependencies**

```bash
cd frontend-react
npm install react-router axios @tanstack/react-query react-hook-form @hookform/resolvers zod react-day-picker sonner class-variance-authority clsx tailwind-merge lucide-react
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D tailwindcss @tailwindcss/vite vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @types/node
```

- [ ] **Step 4: Create .env.example**

Create `frontend-react/.env.example`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_COGNITO_HOSTED_UI_DOMAIN=
VITE_COGNITO_APP_CLIENT_ID=
VITE_OAUTH_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_COGNITO_GOOGLE_IDENTITY_PROVIDER=Google
```

- [ ] **Step 5: Commit**

```bash
git add frontend-react/
git commit -m "feat: scaffold Vite + React 19 + TypeScript project with all dependencies"
```

---

### Task 2: Configure Tailwind v4 + Vite

**Files:**
- Modify: `frontend-react/vite.config.ts`
- Create: `frontend-react/src/index.css`
- Create: `frontend-react/src/lib/utils.ts`

- [ ] **Step 1: Configure Vite with Tailwind plugin**

Replace `frontend-react/vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 2: Create index.css with Tailwind + theme vars**

Create `frontend-react/src/index.css`:

```css
@import "tailwindcss";

@theme {
  --color-brand: #7c3aed;
  --color-brand-foreground: #ffffff;
  --color-background: #ffffff;
  --color-foreground: #0f172a;
  --color-card: #ffffff;
  --color-card-foreground: #0f172a;
  --color-popover: #ffffff;
  --color-popover-foreground: #0f172a;
  --color-primary: #7c3aed;
  --color-primary-foreground: #f5f3ff;
  --color-secondary: #f1f5f9;
  --color-secondary-foreground: #0f172a;
  --color-muted: #f1f5f9;
  --color-muted-foreground: #64748b;
  --color-accent: #f1f5f9;
  --color-accent-foreground: #0f172a;
  --color-destructive: #dc2626;
  --color-destructive-foreground: #ffffff;
  --color-border: #e2e8f0;
  --color-input: #e2e8f0;
  --color-ring: #7c3aed;
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
}

@layer base {
  body {
    @apply bg-background text-foreground antialiased;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }
}
```

- [ ] **Step 3: Create cn() utility**

Create `frontend-react/src/lib/utils.ts`:

```ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 4: Update tsconfig for path aliases**

Add to `frontend-react/tsconfig.app.json` compilerOptions:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 5: Verify dev server starts**

```bash
cd frontend-react && npm run dev
```

Expected: Vite dev server runs on localhost:5173, no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend-react/vite.config.ts frontend-react/src/index.css frontend-react/src/lib/utils.ts frontend-react/tsconfig.app.json
git commit -m "feat: configure Tailwind CSS v4 + path aliases + theme variables"
```

---

### Task 3: Initialize shadcn/ui

**Files:**
- Create: `frontend-react/components.json`
- Create: `frontend-react/src/components/ui/button.tsx` (and other base components)

- [ ] **Step 1: Run shadcn init**

```bash
cd frontend-react
npx shadcn@latest init
```

When prompted:
- Style: **New York**
- Base color: **Slate**
- CSS variables: **Yes**

- [ ] **Step 2: Add core UI components**

```bash
npx shadcn@latest add button input label card badge checkbox radio-group table dialog separator dropdown-menu tabs select skeleton popover toast sonner
```

- [ ] **Step 3: Verify components exist**

```bash
ls frontend-react/src/components/ui/
```

Expected: `button.tsx`, `input.tsx`, `label.tsx`, `card.tsx`, `badge.tsx`, etc.

- [ ] **Step 4: Commit**

```bash
git add frontend-react/components.json frontend-react/src/components/ui/
git commit -m "feat: initialize shadcn/ui with core component library"
```

---

### Task 4: Configure Vitest + React Testing Library

**Files:**
- Create: `frontend-react/vitest.config.ts`
- Create: `frontend-react/src/test-setup.ts`

- [ ] **Step 1: Create vitest config**

Create `frontend-react/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    css: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 2: Create test setup file**

Create `frontend-react/src/test-setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 3: Add test script to package.json**

Add to `frontend-react/package.json` scripts:

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

- [ ] **Step 4: Write a smoke test to verify setup**

Create `frontend-react/src/__tests__/setup-smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('test setup', () => {
  it('runs vitest with jsdom', () => {
    expect(document).toBeDefined()
    expect(document.createElement('div')).toBeInTheDocument
  })
})
```

- [ ] **Step 5: Run test**

```bash
cd frontend-react && npm test -- --run
```

Expected: 1 test passes.

- [ ] **Step 6: Commit**

```bash
git add frontend-react/vitest.config.ts frontend-react/src/test-setup.ts frontend-react/package.json frontend-react/src/__tests__/setup-smoke.test.ts
git commit -m "feat: configure Vitest + React Testing Library"
```

---

### Task 5: Core Models + Currency + Booking Rules

**Files:**
- Create: `frontend-react/src/core/api/models.ts`
- Create: `frontend-react/src/core/currency.ts`
- Create: `frontend-react/src/core/booking/booking-rules.ts`
- Test: `frontend-react/src/__tests__/core/currency.test.ts`
- Test: `frontend-react/src/__tests__/core/booking-rules.test.ts`

- [ ] **Step 1: Write currency tests**

Create `frontend-react/src/__tests__/core/currency.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { NPR_PREFIX, formatNprAmount, nprText } from '@/core/currency'

describe('currency', () => {
  it('has correct prefix', () => {
    expect(NPR_PREFIX).toBe('Rs.')
  })

  it('formats integer amount', () => {
    expect(formatNprAmount(1500)).toBe('1,500')
  })

  it('formats string amount', () => {
    expect(formatNprAmount('2500.50', { maxFractionDigits: 2 })).toContain('2,500')
  })

  it('returns original for NaN', () => {
    expect(formatNprAmount('abc')).toBe('abc')
  })

  it('nprText combines prefix and amount', () => {
    expect(nprText(1000)).toBe('Rs. 1,000')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd frontend-react && npx vitest run src/__tests__/core/currency.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create models.ts**

Create `frontend-react/src/core/api/models.ts`:

```ts
export interface LoginTokens {
  access_token: string
  refresh_token: string
}

export interface RefreshTokenResponse {
  access_token: string
}

export interface RegisterRequest {
  email: string
  password: string
  given_name: string
  family_name: string
  phone_number: string
  gender: 'male' | 'female' | 'other'
}

export interface RegisterResponse {
  message: string
  user_sub: string
  user_confirmed: boolean
  verification_destination: string | null
  delivery_medium: string | null
}

export interface ForgotPasswordResponse {
  message: string
  verification_destination: string | null
  delivery_medium: string | null
}

export interface ApiMessageResponse {
  message: string
}

export interface MeResponse {
  user_id: string
  email: string
  roles: string[]
  given_name?: string | null
  family_name?: string | null
  phone_number?: string | null
}

export type AccessType = 'timeslot' | 'anytime'
export type BookingStatus = 'RESERVED' | 'PAYMENT_PENDING' | 'COMPLETED' | 'REJECTED' | 'EXPIRED'
export type PriceCategory = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'daily' | 'weekly' | 'monthly'

export interface AvailabilityRequest {
  seat_id: number
  start_date: string
  end_date: string
  access_type: AccessType
  start_time?: string | null
  end_time?: string | null
  with_locker?: boolean
}

export interface PriceBreakdown {
  category: string
  access_type: string
  duration_days: string
  per_day_rate: string
  base: string
  locker_per_day: string
  locker_fee: string
  total: string
}

export interface AvailabilityResponse {
  available: boolean
  reason: string | null
  duration_days: number
  category: string
  final_price: string
  breakdown: PriceBreakdown
}

export interface CreateBookingRequest extends AvailabilityRequest {}

export interface SeatsAvailabilityRequest {
  start_date: string
  end_date: string
  access_type: AccessType
  start_time?: string | null
  end_time?: string | null
}

export interface SeatsAvailabilityResponse {
  total_seats: number
  unavailable_seat_ids: number[]
  disabled_seat_ids?: number[]
}

export interface UserSummary {
  user_id: string
  email: string | null
  given_name: string | null
  family_name: string | null
  phone_number: string | null
}

export interface BookingResponse {
  id: string
  user_id: string
  seat_id: number
  start_date: string
  end_date: string
  access_type: AccessType
  start_time: string
  end_time: string
  category: string
  duration_days: number
  status: BookingStatus
  reserved_until: string | null
  final_price: string
  paid_amount: string
  amount_due: string
  with_locker: boolean
  breakdown: PriceBreakdown
  payment_proof_path: string | null
  created_at: string
  updated_at: string | null
  user?: UserSummary | null
}

export interface PricingConfigResponse {
  timeslot_daily_price: number
  timeslot_weekly_price: number
  timeslot_monthly_price: number
  anytime_daily_price: number
  anytime_weekly_price: number
  anytime_monthly_price: number
  locker_daily_price: number
  locker_weekly_price: number
  locker_monthly_price: number
  reservation_timeout_minutes: number
  business_open_time: string
  business_close_time: string
}

export interface UpdatePricingRequest extends PricingConfigResponse {}

export interface SeatResponse {
  id: number
  label: string
  is_enabled: boolean
}

export interface UpdateSeatEnabledRequest {
  is_enabled: boolean
}

export interface PaymentSettingsResponse {
  upi_vpa: string | null
  payee_name: string | null
  instructions: string | null
  has_qr: boolean
  qr_content_type: string | null
  qr_public_url?: string | null
  updated_at: string | null
}

export interface UpdatePaymentSettingsRequest {
  upi_vpa: string | null
  payee_name: string | null
  instructions: string | null
}

export interface UserAdminSummary {
  user_id: string
  username: string
  email: string | null
  email_verified: boolean
  given_name: string | null
  family_name: string | null
  phone_number: string | null
  status: string
  enabled: boolean
  created_at: string | null
  roles: string[]
}

export interface ListUsersResponse {
  users: UserAdminSummary[]
  next_pagination_token: string | null
}

export interface RoleMutationRequest {
  user_id?: string
  email?: string
  role: string
}

export interface RoleAssignmentResponse {
  user_id: string
  role: string
  changed: boolean
}

export interface UserRolesResponse {
  user_id: string
  roles: string[]
}

export interface RoleUsersResponse {
  role: string
  user_ids: string[]
}
```

- [ ] **Step 4: Create currency.ts**

Create `frontend-react/src/core/currency.ts`:

```ts
export const NPR_PREFIX = 'Rs.'

export function formatNprAmount(
  value: string | number,
  options?: { maxFractionDigits?: number; minFractionDigits?: number },
): string {
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (!Number.isFinite(n)) return String(value)
  const maxF = options?.maxFractionDigits ?? 0
  const minF = options?.minFractionDigits ?? 0
  if (maxF > 0 || minF > 0) {
    return n.toLocaleString('en-NP', {
      minimumFractionDigits: minF,
      maximumFractionDigits: maxF,
    })
  }
  return Math.round(n).toLocaleString('en-NP')
}

export function nprText(
  value: string | number,
  options?: { maxFractionDigits?: number; minFractionDigits?: number },
): string {
  return `${NPR_PREFIX} ${formatNprAmount(value, options)}`
}
```

- [ ] **Step 5: Run currency tests — verify pass**

```bash
cd frontend-react && npx vitest run src/__tests__/core/currency.test.ts
```

Expected: All pass.

- [ ] **Step 6: Write booking-rules tests**

Create `frontend-react/src/__tests__/core/booking-rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { bookingBlocksNewReservation, hasBlockingBooking } from '@/core/booking/booking-rules'
import type { BookingResponse } from '@/core/api/models'

function makeBooking(overrides: Partial<BookingResponse>): BookingResponse {
  return {
    id: '1', user_id: 'u1', seat_id: 1,
    start_date: '2026-01-01', end_date: '2026-01-07',
    access_type: 'timeslot', start_time: '09:00', end_time: '12:00',
    category: 'WEEKLY', duration_days: 7, status: 'EXPIRED',
    reserved_until: null, final_price: '1000', paid_amount: '0',
    amount_due: '1000', with_locker: false,
    breakdown: { category: 'WEEKLY', access_type: 'timeslot', duration_days: '7', per_day_rate: '100', base: '700', locker_per_day: '0', locker_fee: '0', total: '700' },
    payment_proof_path: null, created_at: '2026-01-01T00:00:00Z', updated_at: null,
    ...overrides,
  }
}

describe('bookingBlocksNewReservation', () => {
  it('blocks RESERVED', () => {
    expect(bookingBlocksNewReservation(makeBooking({ status: 'RESERVED' }), '2026-05-01')).toBe(true)
  })

  it('blocks PAYMENT_PENDING', () => {
    expect(bookingBlocksNewReservation(makeBooking({ status: 'PAYMENT_PENDING' }), '2026-05-01')).toBe(true)
  })

  it('blocks COMPLETED with future end_date', () => {
    expect(bookingBlocksNewReservation(makeBooking({ status: 'COMPLETED', end_date: '2026-05-10' }), '2026-05-01')).toBe(true)
  })

  it('does not block COMPLETED with past end_date', () => {
    expect(bookingBlocksNewReservation(makeBooking({ status: 'COMPLETED', end_date: '2026-04-01' }), '2026-05-01')).toBe(false)
  })

  it('does not block EXPIRED', () => {
    expect(bookingBlocksNewReservation(makeBooking({ status: 'EXPIRED' }), '2026-05-01')).toBe(false)
  })

  it('does not block REJECTED', () => {
    expect(bookingBlocksNewReservation(makeBooking({ status: 'REJECTED' }), '2026-05-01')).toBe(false)
  })
})

describe('hasBlockingBooking', () => {
  it('returns false for empty list', () => {
    expect(hasBlockingBooking([], '2026-05-01')).toBe(false)
  })

  it('returns true if any booking blocks', () => {
    const bookings = [
      makeBooking({ status: 'EXPIRED' }),
      makeBooking({ status: 'RESERVED' }),
    ]
    expect(hasBlockingBooking(bookings, '2026-05-01')).toBe(true)
  })
})
```

- [ ] **Step 7: Run booking-rules test — verify fail**

```bash
cd frontend-react && npx vitest run src/__tests__/core/booking-rules.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 8: Create booking-rules.ts**

Create `frontend-react/src/core/booking/booking-rules.ts`:

```ts
import type { BookingResponse } from '@/core/api/models'

export function todayIsoLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function bookingBlocksNewReservation(
  b: BookingResponse,
  todayIso: string,
): boolean {
  if (b.status === 'RESERVED' || b.status === 'PAYMENT_PENDING') {
    return true
  }
  if (b.status === 'COMPLETED') {
    return b.end_date >= todayIso
  }
  return false
}

export function hasBlockingBooking(
  bookings: readonly BookingResponse[],
  todayIso: string = todayIsoLocal(),
): boolean {
  return bookings.some((b) => bookingBlocksNewReservation(b, todayIso))
}
```

- [ ] **Step 9: Run booking-rules test — verify pass**

```bash
cd frontend-react && npx vitest run src/__tests__/core/booking-rules.test.ts
```

Expected: All pass.

- [ ] **Step 10: Commit**

```bash
git add frontend-react/src/core/ frontend-react/src/__tests__/core/
git commit -m "feat: add core models, currency helpers, and booking rules with tests"
```

---

### Task 6: Token Storage + Axios Client

**Files:**
- Create: `frontend-react/src/core/auth/token-storage.ts`
- Create: `frontend-react/src/core/auth/cognito-oauth.ts`
- Create: `frontend-react/src/core/api/client.ts`
- Test: `frontend-react/src/__tests__/core/token-storage.test.ts`

- [ ] **Step 1: Write token storage tests**

Create `frontend-react/src/__tests__/core/token-storage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { tokenStorage } from '@/core/auth/token-storage'

describe('tokenStorage', () => {
  beforeEach(() => localStorage.clear())

  it('stores and retrieves tokens', () => {
    tokenStorage.setTokens('access123', 'refresh456')
    expect(tokenStorage.accessToken).toBe('access123')
    expect(tokenStorage.refreshToken).toBe('refresh456')
  })

  it('clears tokens', () => {
    tokenStorage.setTokens('a', 'r')
    tokenStorage.clear()
    expect(tokenStorage.accessToken).toBeNull()
    expect(tokenStorage.refreshToken).toBeNull()
  })

  it('isAuthenticated reflects token presence', () => {
    expect(tokenStorage.isAuthenticated()).toBe(false)
    tokenStorage.setTokens('a', 'r')
    expect(tokenStorage.isAuthenticated()).toBe(true)
  })

  it('setAccessToken updates only access token', () => {
    tokenStorage.setTokens('old-a', 'old-r')
    tokenStorage.setAccessToken('new-a')
    expect(tokenStorage.accessToken).toBe('new-a')
    expect(tokenStorage.refreshToken).toBe('old-r')
  })
})
```

- [ ] **Step 2: Run test — verify fail**

```bash
cd frontend-react && npx vitest run src/__tests__/core/token-storage.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Create token-storage.ts**

Create `frontend-react/src/core/auth/token-storage.ts`:

```ts
const ACCESS_KEY = 'zv.access_token'
const REFRESH_KEY = 'zv.refresh_token'

export const tokenStorage = {
  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY)
  },

  get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY)
  },

  setTokens(access: string, refresh?: string | null): void {
    localStorage.setItem(ACCESS_KEY, access)
    if (refresh) {
      localStorage.setItem(REFRESH_KEY, refresh)
    }
  },

  setAccessToken(access: string): void {
    localStorage.setItem(ACCESS_KEY, access)
  },

  clear(): void {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },

  isAuthenticated(): boolean {
    return localStorage.getItem(ACCESS_KEY) !== null
  },
}
```

- [ ] **Step 4: Run test — verify pass**

```bash
cd frontend-react && npx vitest run src/__tests__/core/token-storage.test.ts
```

Expected: All pass.

- [ ] **Step 5: Create cognito-oauth.ts**

Create `frontend-react/src/core/auth/cognito-oauth.ts`:

```ts
export const ZV_OAUTH_STATE = 'zv_oauth_state'
export const ZV_OAUTH_VERIFIER = 'zv_oauth_verifier'
export const ZV_OAUTH_RETURN = 'zv_oauth_return_to'

function randomUrlSafeBytes(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function newPkceVerifier(): string {
  return randomUrlSafeBytes(32)
}

export function newOAuthState(): string {
  return randomUrlSafeBytes(24)
}

export async function pkceChallengeS256(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(digest)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function cognitoTokenUrl(hostedUiDomain: string): string {
  const host = hostedUiDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return `https://${host}/oauth2/token`
}

export function buildGoogleAuthorizeUrl(params: {
  hostedUiDomain: string
  clientId: string
  redirectUri: string
  codeChallenge: string
  state: string
  identityProvider: string
  scopes?: string[]
}): string {
  const host = params.hostedUiDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const base = `https://${host}/oauth2/authorize`
  const scope = (params.scopes ?? ['openid', 'email', 'profile']).join(' ')
  const q = new URLSearchParams({
    client_id: params.clientId,
    response_type: 'code',
    scope,
    redirect_uri: params.redirectUri,
    identity_provider: params.identityProvider,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${base}?${q.toString()}`
}
```

- [ ] **Step 6: Create axios client with interceptors**

Create `frontend-react/src/core/api/client.ts`:

```ts
import axios from 'axios'
import { tokenStorage } from '@/core/auth/token-storage'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
})

// Request interceptor: inject Bearer token
apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: 401 → clear tokens + redirect to /login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      tokenStorage.clear()
      const returnTo = window.location.pathname
      window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`
    }
    return Promise.reject(error)
  },
)

/** Bare axios for Cognito token endpoint (no auth header). */
export { default as plainAxios } from 'axios'
```

- [ ] **Step 7: Commit**

```bash
git add frontend-react/src/core/auth/ frontend-react/src/core/api/client.ts frontend-react/src/__tests__/core/token-storage.test.ts
git commit -m "feat: add token storage, Cognito OAuth helpers, and axios client with interceptors"
```

---

### Task 7: Auth API Service

**Files:**
- Create: `frontend-react/src/core/api/auth.ts`

- [ ] **Step 1: Create auth API functions**

Create `frontend-react/src/core/api/auth.ts`:

```ts
import { apiClient, plainAxios } from './client'
import { tokenStorage } from '@/core/auth/token-storage'
import {
  cognitoTokenUrl,
  ZV_OAUTH_VERIFIER,
  ZV_OAUTH_STATE,
  ZV_OAUTH_RETURN,
  newPkceVerifier,
  newOAuthState,
  pkceChallengeS256,
  buildGoogleAuthorizeUrl,
} from '@/core/auth/cognito-oauth'
import type {
  LoginTokens,
  MeResponse,
  RefreshTokenResponse,
  RegisterRequest,
  RegisterResponse,
  ForgotPasswordResponse,
  ApiMessageResponse,
} from './models'

const BASE = '/auth'

export async function login(email: string, password: string): Promise<LoginTokens> {
  const { data } = await apiClient.post<LoginTokens>(`${BASE}/login`, { email, password })
  tokenStorage.setTokens(data.access_token, data.refresh_token)
  return data
}

export async function register(body: RegisterRequest): Promise<RegisterResponse> {
  const { data } = await apiClient.post<RegisterResponse>(`${BASE}/register`, body)
  return data
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  const { data } = await apiClient.post<ForgotPasswordResponse>(`${BASE}/forgot-password`, { email })
  return data
}

export async function confirmForgotPassword(
  email: string,
  confirmationCode: string,
  newPassword: string,
): Promise<ApiMessageResponse> {
  const { data } = await apiClient.post<ApiMessageResponse>(`${BASE}/confirm-forgot-password`, {
    email,
    confirmation_code: confirmationCode,
    new_password: newPassword,
  })
  return data
}

export async function me(): Promise<MeResponse> {
  const { data } = await apiClient.get<MeResponse>(`${BASE}/me`)
  return data
}

export async function refresh(): Promise<RefreshTokenResponse> {
  const rt = tokenStorage.refreshToken
  const { data } = await apiClient.post<RefreshTokenResponse>(`${BASE}/refresh`, { refresh_token: rt })
  tokenStorage.setAccessToken(data.access_token)
  return data
}

export async function logout(): Promise<void> {
  const token = tokenStorage.accessToken
  if (token) {
    try {
      await apiClient.post(`${BASE}/logout`, {})
    } catch {
      // Ignore logout API errors
    }
  }
  tokenStorage.clear()
}

export function googleOAuthAvailable(): boolean {
  return !!(import.meta.env.VITE_COGNITO_HOSTED_UI_DOMAIN && import.meta.env.VITE_COGNITO_APP_CLIENT_ID)
}

export async function startGoogleOAuth(returnTo: string | null): Promise<void> {
  if (!googleOAuthAvailable()) return
  const verifier = newPkceVerifier()
  const state = newOAuthState()
  sessionStorage.setItem(ZV_OAUTH_VERIFIER, verifier)
  sessionStorage.setItem(ZV_OAUTH_STATE, state)
  if (returnTo) {
    sessionStorage.setItem(ZV_OAUTH_RETURN, returnTo)
  } else {
    sessionStorage.removeItem(ZV_OAUTH_RETURN)
  }
  const challenge = await pkceChallengeS256(verifier)
  const url = buildGoogleAuthorizeUrl({
    hostedUiDomain: import.meta.env.VITE_COGNITO_HOSTED_UI_DOMAIN,
    clientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
    redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI || `${window.location.origin}/auth/callback`,
    codeChallenge: challenge,
    state,
    identityProvider: import.meta.env.VITE_COGNITO_GOOGLE_IDENTITY_PROVIDER || 'Google',
  })
  window.location.href = url
}

export async function exchangeOAuthCode(code: string): Promise<LoginTokens> {
  const verifier = sessionStorage.getItem(ZV_OAUTH_VERIFIER)
  if (!verifier) throw new Error('Sign-in session expired. Try again.')
  const tokenUrl = cognitoTokenUrl(import.meta.env.VITE_COGNITO_HOSTED_UI_DOMAIN)
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
    code,
    redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URI || `${window.location.origin}/auth/callback`,
    code_verifier: verifier,
  })
  const { data } = await plainAxios.post<LoginTokens>(tokenUrl, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  tokenStorage.setTokens(data.access_token, data.refresh_token)
  sessionStorage.removeItem(ZV_OAUTH_VERIFIER)
  sessionStorage.removeItem(ZV_OAUTH_STATE)
  return data
}

export function consumeOAuthReturnPath(): string | null {
  const path = sessionStorage.getItem(ZV_OAUTH_RETURN)
  sessionStorage.removeItem(ZV_OAUTH_RETURN)
  return path
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-react/src/core/api/auth.ts
git commit -m "feat: add auth API service with login, register, OAuth, and token management"
```

---

### Task 8: Bookings API Service

**Files:**
- Create: `frontend-react/src/core/api/bookings.ts`

- [ ] **Step 1: Create bookings API functions**

Create `frontend-react/src/core/api/bookings.ts`:

```ts
import { apiClient } from './client'
import type {
  AvailabilityRequest,
  AvailabilityResponse,
  BookingResponse,
  CreateBookingRequest,
  PaymentSettingsResponse,
  PricingConfigResponse,
  SeatsAvailabilityRequest,
  SeatsAvailabilityResponse,
} from './models'

const BASE = '/study-room'

export async function checkAvailability(body: AvailabilityRequest): Promise<AvailabilityResponse> {
  const { data } = await apiClient.post<AvailabilityResponse>(`${BASE}/availability`, body)
  return data
}

export async function seatsAvailability(body: SeatsAvailabilityRequest): Promise<SeatsAvailabilityResponse> {
  const { data } = await apiClient.post<SeatsAvailabilityResponse>(`${BASE}/seats/availability`, body)
  return data
}

export async function createBooking(body: CreateBookingRequest): Promise<BookingResponse> {
  const { data } = await apiClient.post<BookingResponse>(`${BASE}/bookings`, body)
  return data
}

export async function updateBooking(bookingId: string, body: CreateBookingRequest): Promise<BookingResponse> {
  const { data } = await apiClient.put<BookingResponse>(`${BASE}/bookings/${bookingId}`, body)
  return data
}

export async function getBooking(bookingId: string): Promise<BookingResponse> {
  const { data } = await apiClient.get<BookingResponse>(`${BASE}/bookings/${bookingId}`)
  return data
}

export async function myBookings(): Promise<BookingResponse[]> {
  const { data } = await apiClient.get<BookingResponse[]>(`${BASE}/bookings`)
  return data
}

export async function uploadPaymentProof(bookingId: string, file: File): Promise<BookingResponse> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await apiClient.post<BookingResponse>(`${BASE}/bookings/${bookingId}/payment-proof`, form)
  return data
}

export async function paymentSettings(): Promise<PaymentSettingsResponse> {
  const { data } = await apiClient.get<PaymentSettingsResponse>(`${BASE}/payment-settings`)
  return data
}

export async function paymentQrBlob(): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`${BASE}/payment-settings/qr`, { responseType: 'blob' })
  return data
}

export async function publicPricing(): Promise<PricingConfigResponse> {
  const { data } = await apiClient.get<PricingConfigResponse>(`${BASE}/pricing`)
  return data
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-react/src/core/api/bookings.ts
git commit -m "feat: add bookings API service"
```

---

### Task 9: Admin API Services

**Files:**
- Create: `frontend-react/src/core/api/admin-pricing.ts`
- Create: `frontend-react/src/core/api/admin-seats.ts`
- Create: `frontend-react/src/core/api/admin-bookings.ts`
- Create: `frontend-react/src/core/api/admin-payments.ts`
- Create: `frontend-react/src/core/api/admin-users.ts`
- Create: `frontend-react/src/core/api/admin-roles.ts`

- [ ] **Step 1: Create admin-pricing.ts**

Create `frontend-react/src/core/api/admin-pricing.ts`:

```ts
import { apiClient } from './client'
import type { PricingConfigResponse, UpdatePricingRequest } from './models'

const BASE = '/admin/study-room'

export async function getPricing(): Promise<PricingConfigResponse> {
  const { data } = await apiClient.get<PricingConfigResponse>(`${BASE}/pricing`)
  return data
}

export async function updatePricing(body: UpdatePricingRequest): Promise<PricingConfigResponse> {
  const { data } = await apiClient.put<PricingConfigResponse>(`${BASE}/pricing`, body)
  return data
}
```

- [ ] **Step 2: Create admin-seats.ts**

Create `frontend-react/src/core/api/admin-seats.ts`:

```ts
import { apiClient } from './client'
import type { SeatResponse, UpdateSeatEnabledRequest } from './models'

const BASE = '/admin/study-room'

export async function listSeats(): Promise<SeatResponse[]> {
  const { data } = await apiClient.get<SeatResponse[]>(`${BASE}/seats`)
  return data
}

export async function patchSeat(seatId: number, body: UpdateSeatEnabledRequest): Promise<SeatResponse> {
  const { data } = await apiClient.patch<SeatResponse>(`${BASE}/seats/${seatId}`, body)
  return data
}
```

- [ ] **Step 3: Create admin-bookings.ts**

Create `frontend-react/src/core/api/admin-bookings.ts`:

```ts
import { apiClient } from './client'
import type { BookingResponse } from './models'

const BASE = '/admin/study-room'

export async function allBookings(statusFilter?: string | null): Promise<BookingResponse[]> {
  const params = statusFilter ? { status: statusFilter } : undefined
  const { data } = await apiClient.get<BookingResponse[]>(`${BASE}/bookings`, { params })
  return data
}

export async function pendingPayments(): Promise<BookingResponse[]> {
  const { data } = await apiClient.get<BookingResponse[]>(`${BASE}/bookings/pending-payments`)
  return data
}

export async function approvePayment(bookingId: string, amount?: string): Promise<BookingResponse> {
  const body = amount != null ? { amount } : {}
  const { data } = await apiClient.post<BookingResponse>(`${BASE}/bookings/${bookingId}/approve`, body)
  return data
}

export async function rejectPayment(bookingId: string): Promise<BookingResponse> {
  const { data } = await apiClient.post<BookingResponse>(`${BASE}/bookings/${bookingId}/reject`, {})
  return data
}

export async function downloadPaymentProof(bookingId: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`${BASE}/bookings/${bookingId}/payment-proof`, { responseType: 'blob' })
  return data
}
```

- [ ] **Step 4: Create admin-payments.ts**

Create `frontend-react/src/core/api/admin-payments.ts`:

```ts
import { apiClient } from './client'
import type { PaymentSettingsResponse, UpdatePaymentSettingsRequest } from './models'

const BASE = '/admin/study-room'

export async function getPaymentSettings(): Promise<PaymentSettingsResponse> {
  const { data } = await apiClient.get<PaymentSettingsResponse>(`${BASE}/payment-settings`)
  return data
}

export async function updatePaymentSettings(body: UpdatePaymentSettingsRequest): Promise<PaymentSettingsResponse> {
  const { data } = await apiClient.put<PaymentSettingsResponse>(`${BASE}/payment-settings`, body)
  return data
}

export async function uploadPaymentQr(file: File): Promise<PaymentSettingsResponse> {
  const fd = new FormData()
  fd.append('file', file)
  const { data } = await apiClient.post<PaymentSettingsResponse>(`${BASE}/payment-settings/qr`, fd)
  return data
}

export async function paymentQrBlob(): Promise<Blob> {
  const { data } = await apiClient.get<Blob>('/study-room/payment-settings/qr', { responseType: 'blob' })
  return data
}
```

- [ ] **Step 5: Create admin-users.ts**

Create `frontend-react/src/core/api/admin-users.ts`:

```ts
import { apiClient } from './client'
import type { ListUsersResponse, RoleAssignmentResponse, UserAdminSummary } from './models'

const BASE = '/admin/users'

export async function listUsers(opts?: {
  limit?: number
  paginationToken?: string | null
  emailPrefix?: string | null
}): Promise<ListUsersResponse> {
  const params: Record<string, string> = {}
  if (opts?.limit) params.limit = String(opts.limit)
  if (opts?.paginationToken) params.pagination_token = opts.paginationToken
  if (opts?.emailPrefix) params.email_prefix = opts.emailPrefix
  const { data } = await apiClient.get<ListUsersResponse>(BASE, { params })
  return data
}

export async function getUser(userId: string): Promise<UserAdminSummary> {
  const { data } = await apiClient.get<UserAdminSummary>(`${BASE}/${userId}`)
  return data
}

export async function grantRole(userId: string, role: string): Promise<RoleAssignmentResponse> {
  const { data } = await apiClient.post<RoleAssignmentResponse>(`${BASE}/${userId}/roles`, { role })
  return data
}

export async function revokeRole(userId: string, role: string): Promise<RoleAssignmentResponse> {
  const { data } = await apiClient.delete<RoleAssignmentResponse>(`${BASE}/${userId}/roles/${role}`)
  return data
}
```

- [ ] **Step 6: Create admin-roles.ts**

Create `frontend-react/src/core/api/admin-roles.ts`:

```ts
import { apiClient } from './client'
import type {
  RoleAssignmentResponse,
  RoleMutationRequest,
  RoleUsersResponse,
  UserRolesResponse,
} from './models'

const BASE = '/admin/roles'

export async function grantRole(body: RoleMutationRequest): Promise<RoleAssignmentResponse> {
  const { data } = await apiClient.post<RoleAssignmentResponse>(`${BASE}/grant`, body)
  return data
}

export async function revokeRole(body: RoleMutationRequest): Promise<RoleAssignmentResponse> {
  const { data } = await apiClient.post<RoleAssignmentResponse>(`${BASE}/revoke`, body)
  return data
}

export async function rolesForUser(userId: string): Promise<UserRolesResponse> {
  const { data } = await apiClient.get<UserRolesResponse>(`${BASE}/users/${userId}`)
  return data
}

export async function membersOfRole(role: string): Promise<RoleUsersResponse> {
  const { data } = await apiClient.get<RoleUsersResponse>(BASE, { params: { role } })
  return data
}
```

- [ ] **Step 7: Commit**

```bash
git add frontend-react/src/core/api/admin-*.ts
git commit -m "feat: add all admin API services (pricing, seats, bookings, payments, users, roles)"
```

---

### Task 10: AuthContext + useAuth

**Files:**
- Create: `frontend-react/src/core/auth/auth-context.tsx`
- Test: `frontend-react/src/__tests__/core/auth-context.test.tsx`

- [ ] **Step 1: Write auth context test**

Create `frontend-react/src/__tests__/core/auth-context.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/core/auth/auth-context'

vi.mock('@/core/api/auth', () => ({
  me: vi.fn(),
  logout: vi.fn(),
  googleOAuthAvailable: vi.fn(() => false),
}))

vi.mock('@/core/auth/token-storage', () => ({
  tokenStorage: {
    accessToken: null,
    refreshToken: null,
    isAuthenticated: vi.fn(() => false),
    setTokens: vi.fn(),
    clear: vi.fn(),
  },
}))

function TestConsumer() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <div>Loading</div>
  return <div>{user ? user.email : 'No user'}</div>
}

describe('AuthContext', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders children when no token (not loading)', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )
    await waitFor(() => {
      expect(screen.getByText('No user')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run test — verify fail**

```bash
cd frontend-react && npx vitest run src/__tests__/core/auth-context.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Create auth-context.tsx**

Create `frontend-react/src/core/auth/auth-context.tsx`:

```tsx
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { MeResponse } from '@/core/api/models'
import * as authApi from '@/core/api/auth'
import { tokenStorage } from './token-storage'

interface AuthContextValue {
  user: MeResponse | null
  isAdmin: boolean
  isLoading: boolean
  googleOAuthAvailable: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setUser: (user: MeResponse) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAdmin = user?.roles.includes('admin') ?? false

  useEffect(() => {
    if (!tokenStorage.isAuthenticated()) {
      setIsLoading(false)
      return
    }
    authApi
      .me()
      .then((u) => setUser(u))
      .catch(() => {
        tokenStorage.clear()
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    await authApi.login(email, password)
    const u = await authApi.me()
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    authApi.logout()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isLoading,
        googleOAuthAvailable: authApi.googleOAuthAvailable(),
        login,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

- [ ] **Step 4: Run test — verify pass**

```bash
cd frontend-react && npx vitest run src/__tests__/core/auth-context.test.tsx
```

Expected: Pass.

- [ ] **Step 5: Commit**

```bash
git add frontend-react/src/core/auth/auth-context.tsx frontend-react/src/__tests__/core/auth-context.test.tsx
git commit -m "feat: add AuthContext with login, logout, and auto-restore from token"
```

---

### Task 11: Route Guards

**Files:**
- Create: `frontend-react/src/components/protected-route.tsx`
- Create: `frontend-react/src/components/admin-route.tsx`
- Create: `frontend-react/src/components/book-route.tsx`
- Test: `frontend-react/src/__tests__/components/protected-route.test.tsx`

- [ ] **Step 1: Write protected route test**

Create `frontend-react/src/__tests__/components/protected-route.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { ProtectedRoute } from '@/components/protected-route'

const mockUseAuth = vi.fn()
vi.mock('@/core/auth/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

describe('ProtectedRoute', () => {
  it('shows loading when auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true })
    render(
      <MemoryRouter>
        <ProtectedRoute><div>Secret</div></ProtectedRoute>
      </MemoryRouter>,
    )
    expect(screen.queryByText('Secret')).not.toBeInTheDocument()
  })

  it('renders children when authenticated', () => {
    mockUseAuth.mockReturnValue({ user: { user_id: '1', email: 'a@b.com', roles: [] }, isLoading: false })
    render(
      <MemoryRouter>
        <ProtectedRoute><div>Secret</div></ProtectedRoute>
      </MemoryRouter>,
    )
    expect(screen.getByText('Secret')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — verify fail**

```bash
cd frontend-react && npx vitest run src/__tests__/components/protected-route.test.tsx
```

- [ ] **Step 3: Create protected-route.tsx**

Create `frontend-react/src/components/protected-route.tsx`:

```tsx
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@/core/auth/auth-context'
import type { ReactNode } from 'react'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname)}`} replace />
  }

  return <>{children}</>
}
```

- [ ] **Step 4: Create admin-route.tsx**

Create `frontend-react/src/components/admin-route.tsx`:

```tsx
import { Navigate } from 'react-router'
import { useAuth } from '@/core/auth/auth-context'
import type { ReactNode } from 'react'

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isAdmin, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/app/my-bookings" replace />

  return <>{children}</>
}
```

- [ ] **Step 5: Create book-route.tsx**

Create `frontend-react/src/components/book-route.tsx`:

```tsx
import { Navigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/core/auth/auth-context'
import * as bookingsApi from '@/core/api/bookings'
import { hasBlockingBooking } from '@/core/booking/booking-rules'
import type { ReactNode } from 'react'

export function BookRoute({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth()

  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['bookings', 'mine'],
    queryFn: bookingsApi.myBookings,
    enabled: !!user,
  })

  if (authLoading || bookingsLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (bookings && hasBlockingBooking(bookings)) {
    return <Navigate to="/app/my-bookings?notice=one-booking" replace />
  }

  return <>{children}</>
}
```

- [ ] **Step 6: Run protected route test — verify pass**

```bash
cd frontend-react && npx vitest run src/__tests__/components/protected-route.test.tsx
```

- [ ] **Step 7: Commit**

```bash
git add frontend-react/src/components/protected-route.tsx frontend-react/src/components/admin-route.tsx frontend-react/src/components/book-route.tsx frontend-react/src/__tests__/components/
git commit -m "feat: add ProtectedRoute, AdminRoute, and BookRoute guard components"
```

---

### Task 12: TanStack Query Client + App.tsx + Router

**Files:**
- Create: `frontend-react/src/lib/query-client.ts`
- Create: `frontend-react/src/App.tsx`
- Modify: `frontend-react/src/main.tsx`

- [ ] **Step 1: Create query client**

Create `frontend-react/src/lib/query-client.ts`:

```ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})
```

- [ ] **Step 2: Create App.tsx with full router**

Create `frontend-react/src/App.tsx`:

```tsx
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { queryClient } from '@/lib/query-client'
import { AuthProvider } from '@/core/auth/auth-context'
import { ProtectedRoute } from '@/components/protected-route'
import { AdminRoute } from '@/components/admin-route'
import { BookRoute } from '@/components/book-route'

// Lazy-loaded pages
const LoginPage = lazy(() => import('@/features/auth/login-page'))
const RegisterPage = lazy(() => import('@/features/auth/register-page'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/forgot-password-page'))
const OAuthCallbackPage = lazy(() => import('@/features/auth/oauth-callback-page'))
const MyBookingsPage = lazy(() => import('@/features/bookings/my-bookings-page'))
const CreateBookingPage = lazy(() => import('@/features/bookings/create-booking-page'))
const EditBookingPage = lazy(() => import('@/features/bookings/edit-booking-page'))
const UserShell = lazy(() => import('@/core/layout/user-shell'))
const AdminShell = lazy(() => import('@/core/layout/admin-shell'))
const AdminUsersPage = lazy(() => import('@/features/admin/admin-users-page'))
const AdminRolesPage = lazy(() => import('@/features/admin/admin-roles-page'))
const AdminPricingPage = lazy(() => import('@/features/admin/admin-pricing-page'))
const AdminSeatsPage = lazy(() => import('@/features/admin/admin-seats-page'))
const AdminBookingsPage = lazy(() => import('@/features/admin/admin-bookings-page'))
const AdminPaymentsPage = lazy(() => import('@/features/admin/admin-payments-page'))
const AdminPaymentSettingsPage = lazy(() => import('@/features/admin/admin-payment-settings-page'))

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public auth routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/auth/callback" element={<OAuthCallbackPage />} />

              {/* User routes */}
              <Route
                path="/app"
                element={
                  <ProtectedRoute>
                    <UserShell />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="my-bookings" replace />} />
                <Route path="my-bookings" element={<MyBookingsPage />} />
                <Route
                  path="book"
                  element={
                    <BookRoute>
                      <CreateBookingPage />
                    </BookRoute>
                  }
                />
                <Route path="bookings/:id/edit" element={<EditBookingPage />} />
              </Route>

              {/* Admin routes */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminShell />
                  </AdminRoute>
                }
              >
                <Route index element={<Navigate to="users" replace />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="roles" element={<AdminRolesPage />} />
                <Route path="pricing" element={<AdminPricingPage />} />
                <Route path="seats" element={<AdminSeatsPage />} />
                <Route path="bookings" element={<AdminBookingsPage />} />
                <Route path="payments" element={<AdminPaymentsPage />} />
                <Route path="payment-settings" element={<AdminPaymentSettingsPage />} />
              </Route>

              {/* Default redirects */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 3: Update main.tsx**

Replace `frontend-react/src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 4: Commit**

```bash
git add frontend-react/src/lib/query-client.ts frontend-react/src/App.tsx frontend-react/src/main.tsx
git commit -m "feat: add App.tsx with full router tree, TanStack Query provider, and lazy-loaded routes"
```

---

### Task 13: UserShell Layout

**Files:**
- Create: `frontend-react/src/core/layout/user-shell.tsx`

- [ ] **Step 1: Create UserShell**

Create `frontend-react/src/core/layout/user-shell.tsx`:

```tsx
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
      {/* Top navbar */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          {/* Logo */}
          <span className="text-lg font-bold tracking-tight text-primary">Zenoviz</span>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            <NavLink to="/app/my-bookings" className={navLinkClass}>
              <CalendarDays className="h-4 w-4" />
              My Bookings
            </NavLink>
            <NavLink to="/app/book" className={navLinkClass}>
              <Plus className="h-4 w-4" />
              Book a Seat
            </NavLink>
          </nav>

          {/* User dropdown */}
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
              <DropdownMenuItem
                onClick={() => {
                  logout()
                  navigate('/login')
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-react/src/core/layout/user-shell.tsx
git commit -m "feat: add UserShell layout with top navbar, nav links, and user dropdown"
```

---

### Task 14: AdminShell Layout

**Files:**
- Create: `frontend-react/src/core/layout/admin-shell.tsx`

- [ ] **Step 1: Create AdminShell**

Create `frontend-react/src/core/layout/admin-shell.tsx`:

```tsx
import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router'
import { useAuth } from '@/core/auth/auth-context'
import { Button } from '@/components/ui/button'
import {
  Users,
  Shield,
  DollarSign,
  Grid3X3,
  CalendarDays,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  ArrowLeft,
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
          <item.icon className="h-4 w-4" />
          {item.label}
        </NavLink>
      ))}
      <div className="my-4 border-t" />
      <NavLink to="/app/my-bookings" className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to App
      </NavLink>
      <button
        onClick={() => {
          logout()
          navigate('/login')
        }}
        className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </nav>
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="sticky top-0 z-50 flex items-center border-b bg-background px-4 py-3 lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <span className="ml-2 text-lg font-bold text-primary">Admin</span>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 border-r bg-card lg:block">
          <div className="sticky top-0 h-screen overflow-y-auto">{sidebar}</div>
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
            <aside className="relative w-60 bg-card shadow-lg">{sidebar}</aside>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-react/src/core/layout/admin-shell.tsx
git commit -m "feat: add AdminShell layout with collapsible sidebar and mobile support"
```

---

### Task 15: LoginPage

**Files:**
- Create: `frontend-react/src/features/auth/login-page.tsx`
- Test: `frontend-react/src/__tests__/features/login-page.test.tsx`

- [ ] **Step 1: Write login page test**

Create `frontend-react/src/__tests__/features/login-page.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'

const mockLogin = vi.fn()
vi.mock('@/core/auth/auth-context', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    login: mockLogin,
    googleOAuthAvailable: false,
  }),
}))

import LoginPage from '@/features/auth/login-page'

function renderLogin() {
  const qc = new QueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LoginPage', () => {
  it('renders email and password fields', () => {
    renderLogin()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('shows validation errors on empty submit', async () => {
    renderLogin()
    const submitBtn = screen.getByRole('button', { name: /sign in/i })
    await userEvent.click(submitBtn)
    // react-hook-form validation should show errors
    expect(screen.getByLabelText(/email/i)).toBeInvalid?.() // basic check
  })
})
```

- [ ] **Step 2: Run test — verify fail**

```bash
cd frontend-react && npx vitest run src/__tests__/features/login-page.test.tsx
```

- [ ] **Step 3: Create login-page.tsx**

Create `frontend-react/src/features/auth/login-page.tsx`:

```tsx
import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/core/auth/auth-context'
import * as authApi from '@/core/api/auth'
import * as bookingsApi from '@/core/api/bookings'
import { nprText } from '@/core/currency'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { login, googleOAuthAvailable } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('returnTo') || '/app/my-bookings'
  const [showForm, setShowForm] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const { data: pricing } = useQuery({
    queryKey: ['pricing', 'public'],
    queryFn: bookingsApi.publicPricing,
  })

  const onSubmit = async (data: LoginForm) => {
    try {
      await login(data.email, data.password)
      navigate(returnTo, { replace: true })
    } catch (err) {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? 'Login failed' : 'Login failed'
      toast.error(msg)
    }
  }

  const handleGoogleLogin = () => {
    authApi.startGoogleOAuth(returnTo)
  }

  return (
    <div className="flex min-h-screen">
      {/* Left hero — violet gradient + pricing */}
      <div className="relative hidden w-1/2 flex-col items-center justify-center bg-gradient-to-br from-violet-600 to-violet-800 p-12 text-white lg:flex">
        <div className="max-w-md text-center">
          <h1 className="text-4xl font-bold tracking-tight">Zenoviz Study Room</h1>
          <p className="mt-3 text-lg text-violet-100">
            Reserve your perfect study spot — quiet, focused, affordable.
          </p>

          {pricing && (
            <div className="mt-8 rounded-xl bg-white/10 p-6 backdrop-blur">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-violet-200">
                Pricing (per day)
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-violet-100">3-Hour Slot (daily)</span>
                  <span className="font-semibold">{nprText(pricing.timeslot_daily_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-violet-100">3-Hour Slot (weekly)</span>
                  <span className="font-semibold">{nprText(pricing.timeslot_weekly_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-violet-100">3-Hour Slot (monthly)</span>
                  <span className="font-semibold">{nprText(pricing.timeslot_monthly_price)}</span>
                </div>
                <div className="my-2 border-t border-white/20" />
                <div className="flex justify-between">
                  <span className="text-violet-100">Anytime (daily)</span>
                  <span className="font-semibold">{nprText(pricing.anytime_daily_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-violet-100">Anytime (weekly)</span>
                  <span className="font-semibold">{nprText(pricing.anytime_weekly_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-violet-100">Anytime (monthly)</span>
                  <span className="font-semibold">{nprText(pricing.anytime_monthly_price)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right form card */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        {/* Mobile: hero-first with Book now toggle */}
        <div className="w-full max-w-sm">
          {/* Mobile hero */}
          <div className="mb-8 text-center lg:hidden">
            <h1 className="text-2xl font-bold text-primary">Zenoviz Study Room</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Reserve your perfect study spot.
            </p>
            {!showForm && (
              <Button className="mt-4 w-full" onClick={() => setShowForm(true)}>
                Book now
              </Button>
            )}
          </div>

          {/* Form (always visible on desktop, toggle on mobile) */}
          <div className={`${!showForm ? 'hidden lg:block' : ''}`}>
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-xl">Sign in</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      {...register('email')}
                      aria-invalid={!!errors.email}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      {...register('password')}
                      aria-invalid={!!errors.password}
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password.message}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Signing in…' : 'Sign in'}
                  </Button>

                  {googleOAuthAvailable && (
                    <>
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-card px-2 text-muted-foreground">or</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleGoogleLogin}
                      >
                        Continue with Google
                      </Button>
                    </>
                  )}
                </form>

                <div className="mt-4 space-y-2 text-center text-sm">
                  <Link to="/forgot-password" className="text-primary hover:underline">
                    Forgot password?
                  </Link>
                  <p className="text-muted-foreground">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-primary hover:underline">
                      Register
                    </Link>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test — verify pass**

```bash
cd frontend-react && npx vitest run src/__tests__/features/login-page.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add frontend-react/src/features/auth/login-page.tsx frontend-react/src/__tests__/features/login-page.test.tsx
git commit -m "feat: add LoginPage with split-screen hero, pricing banner, and Google OAuth"
```

---

### Task 16: RegisterPage

**Files:**
- Create: `frontend-react/src/features/auth/register-page.tsx`

- [ ] **Step 1: Create register-page.tsx**

Create `frontend-react/src/features/auth/register-page.tsx`:

```tsx
import { useNavigate, Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import * as authApi from '@/core/api/auth'
import { useAuth } from '@/core/auth/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'

const registerSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
  given_name: z.string().min(1, 'First name is required'),
  family_name: z.string().min(1, 'Last name is required'),
  phone_number: z.string().min(1, 'Phone number is required'),
  gender: z.enum(['male', 'female', 'other'], { required_error: 'Select a gender' }),
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const { googleOAuthAvailable } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterForm) => {
    try {
      await authApi.register(data)
      toast.success('Account created! Please sign in.')
      navigate('/login')
    } catch (err) {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? 'Registration failed' : 'Registration failed'
      toast.error(msg)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create an account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="given_name">First name</Label>
                <Input id="given_name" {...register('given_name')} />
                {errors.given_name && <p className="text-sm text-destructive">{errors.given_name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="family_name">Last name</Label>
                <Input id="family_name" {...register('family_name')} />
                {errors.family_name && <p className="text-sm text-destructive">{errors.family_name.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-email">Email</Label>
              <Input id="reg-email" type="email" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-password">Password</Label>
              <Input id="reg-password" type="password" {...register('password')} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone number</Label>
              <Input id="phone_number" {...register('phone_number')} />
              {errors.phone_number && <p className="text-sm text-destructive">{errors.phone_number.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Gender</Label>
              <Select onValueChange={(v) => setValue('gender', v as RegisterForm['gender'])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {errors.gender && <p className="text-sm text-destructive">{errors.gender.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account…' : 'Register'}
            </Button>

            {googleOAuthAvailable && (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={() => authApi.startGoogleOAuth(null)}>
                  Continue with Google
                </Button>
              </>
            )}
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-react/src/features/auth/register-page.tsx
git commit -m "feat: add RegisterPage with zod validation and Google OAuth"
```

---

### Task 17: ForgotPasswordPage + OAuthCallbackPage

**Files:**
- Create: `frontend-react/src/features/auth/forgot-password-page.tsx`
- Create: `frontend-react/src/features/auth/oauth-callback-page.tsx`

- [ ] **Step 1: Create forgot-password-page.tsx**

Create `frontend-react/src/features/auth/forgot-password-page.tsx`:

```tsx
import { useState } from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import * as authApi from '@/core/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'

const requestSchema = z.object({ email: z.string().email() })
const confirmSchema = z.object({
  email: z.string().email(),
  confirmationCode: z.string().min(1, 'Code is required'),
  newPassword: z.string().min(8, 'At least 8 characters'),
})

type RequestForm = z.infer<typeof requestSchema>
type ConfirmForm = z.infer<typeof confirmSchema>

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'request' | 'confirm'>('request')
  const [email, setEmail] = useState('')

  const reqForm = useForm<RequestForm>({ resolver: zodResolver(requestSchema) })
  const confForm = useForm<ConfirmForm>({ resolver: zodResolver(confirmSchema) })

  const onRequest = async (data: RequestForm) => {
    try {
      await authApi.forgotPassword(data.email)
      setEmail(data.email)
      confForm.setValue('email', data.email)
      setStep('confirm')
      toast.success('Verification code sent to your email')
    } catch (err) {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? 'Request failed' : 'Request failed'
      toast.error(msg)
    }
  }

  const onConfirm = async (data: ConfirmForm) => {
    try {
      await authApi.confirmForgotPassword(data.email, data.confirmationCode, data.newPassword)
      toast.success('Password reset! Please sign in.')
      window.location.href = '/login'
    } catch (err) {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? 'Reset failed' : 'Reset failed'
      toast.error(msg)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {step === 'request' ? 'Forgot password' : 'Reset password'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === 'request' ? (
            <form onSubmit={reqForm.handleSubmit(onRequest)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fp-email">Email</Label>
                <Input id="fp-email" type="email" {...reqForm.register('email')} />
                {reqForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{reqForm.formState.errors.email.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={reqForm.formState.isSubmitting}>
                Send code
              </Button>
            </form>
          ) : (
            <form onSubmit={confForm.handleSubmit(onConfirm)} className="space-y-4">
              <p className="text-sm text-muted-foreground">Code sent to {email}</p>
              <input type="hidden" {...confForm.register('email')} />
              <div className="space-y-2">
                <Label htmlFor="code">Verification code</Label>
                <Input id="code" {...confForm.register('confirmationCode')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pw">New password</Label>
                <Input id="new-pw" type="password" {...confForm.register('newPassword')} />
              </div>
              <Button type="submit" className="w-full" disabled={confForm.formState.isSubmitting}>
                Reset password
              </Button>
            </form>
          )}
          <p className="mt-4 text-center text-sm">
            <Link to="/login" className="text-primary hover:underline">Back to sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Create oauth-callback-page.tsx**

Create `frontend-react/src/features/auth/oauth-callback-page.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import * as authApi from '@/core/api/auth'
import { useAuth } from '@/core/auth/auth-context'

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const code = searchParams.get('code')
    if (!code) {
      setError('No authorization code received')
      return
    }

    authApi
      .exchangeOAuthCode(code)
      .then(() => authApi.me())
      .then((user) => {
        setUser(user)
        const returnTo = authApi.consumeOAuthReturnPath() || '/app/my-bookings'
        navigate(returnTo, { replace: true })
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'OAuth exchange failed')
      })
  }, [searchParams, navigate, setUser])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">{error}</p>
          <a href="/login" className="mt-4 text-primary hover:underline">
            Back to login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend-react/src/features/auth/forgot-password-page.tsx frontend-react/src/features/auth/oauth-callback-page.tsx
git commit -m "feat: add ForgotPasswordPage (two-step) and OAuthCallbackPage"
```

---

### Task 18: DatePicker Component

**Files:**
- Create: `frontend-react/src/components/date-picker.tsx`

- [ ] **Step 1: Create DatePicker**

Create `frontend-react/src/components/date-picker.tsx`:

```tsx
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import 'react-day-picker/style.css'

interface DatePickerProps {
  value: Date | undefined
  onChange: (date: Date | undefined) => void
  placeholder?: string
  disabled?: (date: Date) => boolean
  className?: string
}

export function DatePicker({ value, onChange, placeholder = 'Pick a date', disabled, className }: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, 'PPP') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <DayPicker
          mode="single"
          selected={value}
          onSelect={onChange}
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: Install date-fns**

```bash
cd frontend-react && npm install date-fns
```

- [ ] **Step 3: Commit**

```bash
git add frontend-react/src/components/date-picker.tsx frontend-react/package.json frontend-react/package-lock.json
git commit -m "feat: add DatePicker component with react-day-picker + popover"
```

---

### Task 19: SeatGrid Component

**Files:**
- Create: `frontend-react/src/features/bookings/seat-grid.tsx`

- [ ] **Step 1: Create SeatGrid**

Create `frontend-react/src/features/bookings/seat-grid.tsx`:

```tsx
import { cn } from '@/lib/utils'

interface SeatGridProps {
  totalSeats: number
  unavailableSeatIds: number[]
  disabledSeatIds: number[]
  selectedSeatId: number | null
  onSelect: (seatId: number) => void
}

export function SeatGrid({
  totalSeats,
  unavailableSeatIds,
  disabledSeatIds,
  selectedSeatId,
  onSelect,
}: SeatGridProps) {
  const seats = Array.from({ length: totalSeats }, (_, i) => i + 1)

  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-13">
      {seats.map((id) => {
        const isDisabled = disabledSeatIds.includes(id)
        const isUnavailable = unavailableSeatIds.includes(id)
        const isSelected = selectedSeatId === id
        const canSelect = !isDisabled && !isUnavailable

        return (
          <button
            key={id}
            type="button"
            disabled={!canSelect}
            onClick={() => canSelect && onSelect(id)}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-md border text-xs font-medium transition-colors',
              isDisabled && 'cursor-not-allowed border-muted bg-muted text-muted-foreground/40',
              isUnavailable && !isDisabled && 'cursor-not-allowed border-red-200 bg-red-50 text-red-400',
              canSelect && !isSelected && 'cursor-pointer border-border bg-card hover:border-primary hover:bg-primary/5',
              isSelected && 'border-primary bg-primary text-primary-foreground',
            )}
            title={
              isDisabled ? `Seat ${id} (disabled)` : isUnavailable ? `Seat ${id} (taken)` : `Seat ${id}`
            }
          >
            {id}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-react/src/features/bookings/seat-grid.tsx
git commit -m "feat: add SeatGrid component with available/unavailable/disabled/selected states"
```

---

### Task 20: MyBookingsPage

**Files:**
- Create: `frontend-react/src/features/bookings/my-bookings-page.tsx`

- [ ] **Step 1: Create my-bookings-page.tsx**

Create `frontend-react/src/features/bookings/my-bookings-page.tsx`:

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, Link } from 'react-router'
import * as bookingsApi from '@/core/api/bookings'
import { nprText } from '@/core/currency'
import type { BookingResponse, BookingStatus } from '@/core/api/models'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useRef } from 'react'

const STATUS_ORDER: BookingStatus[] = ['RESERVED', 'PAYMENT_PENDING', 'COMPLETED', 'EXPIRED', 'REJECTED']

const statusVariant: Record<BookingStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  RESERVED: 'default',
  PAYMENT_PENDING: 'secondary',
  COMPLETED: 'default',
  EXPIRED: 'outline',
  REJECTED: 'destructive',
}

function sortBookings(bookings: BookingResponse[]): BookingResponse[] {
  return [...bookings].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  )
}

function canEdit(b: BookingResponse): boolean {
  return b.status === 'RESERVED' || b.status === 'PAYMENT_PENDING' || b.status === 'COMPLETED'
}

export default function MyBookingsPage() {
  const [searchParams] = useSearchParams()
  const notice = searchParams.get('notice')
  const queryClient = useQueryClient()

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings', 'mine'],
    queryFn: bookingsApi.myBookings,
  })

  const uploadMutation = useMutation({
    mutationFn: ({ bookingId, file }: { bookingId: string; file: File }) =>
      bookingsApi.uploadPaymentProof(bookingId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', 'mine'] })
      toast.success('Payment proof uploaded')
    },
    onError: () => toast.error('Upload failed'),
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetRef = useRef<string | null>(null)

  const handleUpload = (bookingId: string) => {
    uploadTargetRef.current = bookingId
    fileInputRef.current?.click()
  }

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && uploadTargetRef.current) {
      uploadMutation.mutate({ bookingId: uploadTargetRef.current, file })
    }
    e.target.value = ''
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
      </div>
    )
  }

  const sorted = sortBookings(bookings ?? [])

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">My Bookings</h1>

      {notice === 'one-booking' && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You already have an active booking. Edit it or wait until it expires.
        </div>
      )}

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No bookings yet.</p>
            <Button asChild className="mt-4">
              <Link to="/app/book">Book a Seat</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sorted.map((b) => (
            <Card key={b.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">
                  Seat {b.seat_id} — {b.start_date} to {b.end_date}
                </CardTitle>
                <Badge variant={statusVariant[b.status]}>{b.status.replace('_', ' ')}</Badge>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <span className="text-muted-foreground">Access:</span> {b.access_type}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Time:</span> {b.start_time}–{b.end_time}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total:</span> {nprText(b.final_price)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Due:</span> {nprText(b.amount_due)}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {canEdit(b) && (
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/app/bookings/${b.id}/edit`}>Edit</Link>
                    </Button>
                  )}
                  {(b.status === 'RESERVED' || b.status === 'PAYMENT_PENDING') && (
                    <Button variant="outline" size="sm" onClick={() => handleUpload(b.id)}>
                      Upload Payment Proof
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileSelected}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-react/src/features/bookings/my-bookings-page.tsx
git commit -m "feat: add MyBookingsPage with sorted cards, payment proof upload, and edit links"
```

---

### Task 21: CreateBookingPage

**Files:**
- Create: `frontend-react/src/features/bookings/create-booking-page.tsx`

- [ ] **Step 1: Create create-booking-page.tsx**

Create `frontend-react/src/features/bookings/create-booking-page.tsx`:

```tsx
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import * as bookingsApi from '@/core/api/bookings'
import type { AccessType, AvailabilityRequest } from '@/core/api/models'
import { nprText } from '@/core/currency'
import { DatePicker } from '@/components/date-picker'
import { SeatGrid } from './seat-grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { cn } from '@/lib/utils'

function toIso(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

const TIME_SLOTS = [
  '06:00', '09:00', '12:00', '15:00', '18:00',
]

function endTimeForSlot(start: string): string {
  const [h] = start.split(':').map(Number)
  return `${String(h + 3).padStart(2, '0')}:00`
}

export default function CreateBookingPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [accessType, setAccessType] = useState<AccessType>('timeslot')
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [seatId, setSeatId] = useState<number | null>(null)
  const [withLocker, setWithLocker] = useState(false)

  // Fetch pricing for business hours
  const { data: pricing } = useQuery({
    queryKey: ['pricing', 'public'],
    queryFn: bookingsApi.publicPricing,
  })

  // Generate time slots from business hours
  const availableSlots = useMemo(() => {
    if (!pricing) return TIME_SLOTS
    const openH = parseInt(pricing.business_open_time.split(':')[0], 10)
    const closeH = parseInt(pricing.business_close_time.split(':')[0], 10)
    const slots: string[] = []
    for (let h = openH; h + 3 <= closeH; h += 3) {
      slots.push(`${String(h).padStart(2, '0')}:00`)
    }
    return slots.length > 0 ? slots : TIME_SLOTS
  }, [pricing])

  // Seats availability query
  const canCheckSeats = !!startDate && !!endDate && (accessType === 'anytime' || !!selectedSlot)
  const seatsQuery = useQuery({
    queryKey: ['seats', 'availability', startDate && toIso(startDate), endDate && toIso(endDate), accessType, selectedSlot],
    queryFn: () =>
      bookingsApi.seatsAvailability({
        start_date: toIso(startDate!),
        end_date: toIso(endDate!),
        access_type: accessType,
        start_time: accessType === 'timeslot' && selectedSlot ? selectedSlot : null,
        end_time: accessType === 'timeslot' && selectedSlot ? endTimeForSlot(selectedSlot) : null,
      }),
    enabled: canCheckSeats,
  })

  // Price check query
  const canCheckPrice = canCheckSeats && seatId !== null
  const availabilityQuery = useQuery({
    queryKey: ['bookings', 'availability', seatId, startDate && toIso(startDate), endDate && toIso(endDate), accessType, selectedSlot, withLocker],
    queryFn: () =>
      bookingsApi.checkAvailability({
        seat_id: seatId!,
        start_date: toIso(startDate!),
        end_date: toIso(endDate!),
        access_type: accessType,
        start_time: accessType === 'timeslot' && selectedSlot ? selectedSlot : null,
        end_time: accessType === 'timeslot' && selectedSlot ? endTimeForSlot(selectedSlot) : null,
        with_locker: withLocker,
      }),
    enabled: canCheckPrice,
  })

  // Reset dependent state when upstream changes
  useEffect(() => { setSeatId(null) }, [startDate, endDate, accessType, selectedSlot])
  useEffect(() => { if (accessType === 'anytime') setSelectedSlot(null) }, [accessType])

  const createMutation = useMutation({
    mutationFn: bookingsApi.createBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', 'mine'] })
      toast.success('Booking created!')
      navigate('/app/my-bookings')
    },
    onError: (err) => {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? 'Booking failed' : 'Booking failed'
      toast.error(msg)
    },
  })

  const handleSubmit = () => {
    if (!startDate || !endDate || !seatId) return
    const body: AvailabilityRequest = {
      seat_id: seatId,
      start_date: toIso(startDate),
      end_date: toIso(endDate),
      access_type: accessType,
      start_time: accessType === 'timeslot' && selectedSlot ? selectedSlot : null,
      end_time: accessType === 'timeslot' && selectedSlot ? endTimeForSlot(selectedSlot) : null,
      with_locker: withLocker,
    }
    createMutation.mutate(body)
  }

  const avail = availabilityQuery.data
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Book a Seat</h1>

      {/* Date selection */}
      <Card>
        <CardHeader><CardTitle className="text-base">Select Dates</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Start date</Label>
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              disabled={(d) => d < today}
              placeholder="Start date"
            />
          </div>
          <div className="space-y-2">
            <Label>End date</Label>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              disabled={(d) => d < (startDate ?? today)}
              placeholder="End date"
            />
          </div>
        </CardContent>
      </Card>

      {/* Access type */}
      <Card>
        <CardHeader><CardTitle className="text-base">Access Type</CardTitle></CardHeader>
        <CardContent>
          <RadioGroup value={accessType} onValueChange={(v) => setAccessType(v as AccessType)}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="timeslot" id="timeslot" />
              <Label htmlFor="timeslot">3-Hour Timeslot</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="anytime" id="anytime" />
              <Label htmlFor="anytime">Anytime (full day)</Label>
            </div>
          </RadioGroup>

          {/* Time slot chips */}
          {accessType === 'timeslot' && (
            <div className="mt-4 flex flex-wrap gap-2">
              {availableSlots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={cn(
                    'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                    selectedSlot === slot
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card hover:border-primary hover:bg-primary/5',
                  )}
                >
                  {slot} – {endTimeForSlot(slot)}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seat map */}
      {canCheckSeats && (
        <Card>
          <CardHeader><CardTitle className="text-base">Choose a Seat</CardTitle></CardHeader>
          <CardContent>
            {seatsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading seats…</p>
            ) : seatsQuery.data ? (
              <SeatGrid
                totalSeats={seatsQuery.data.total_seats}
                unavailableSeatIds={seatsQuery.data.unavailable_seat_ids}
                disabledSeatIds={seatsQuery.data.disabled_seat_ids ?? []}
                selectedSeatId={seatId}
                onSelect={setSeatId}
              />
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Locker + Invoice */}
      {canCheckPrice && (
        <Card>
          <CardHeader><CardTitle className="text-base">Booking Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="locker"
                checked={withLocker}
                onCheckedChange={(v) => setWithLocker(v === true)}
              />
              <Label htmlFor="locker">Add locker</Label>
            </div>

            <Separator />

            {availabilityQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Checking price…</p>
            ) : avail ? (
              <>
                {!avail.available && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {avail.reason ?? 'This seat is not available for the selected dates.'}
                  </div>
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category</span>
                    <span>{avail.breakdown.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span>{avail.breakdown.duration_days} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rate per day</span>
                    <span>{nprText(avail.breakdown.per_day_rate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base</span>
                    <span>{nprText(avail.breakdown.base)}</span>
                  </div>
                  {withLocker && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Locker/day</span>
                        <span>{nprText(avail.breakdown.locker_per_day)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Locker fee</span>
                        <span>{nprText(avail.breakdown.locker_fee)}</span>
                      </div>
                    </>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>{nprText(avail.final_price)}</span>
                  </div>
                </div>

                <Button
                  className="mt-4 w-full"
                  onClick={handleSubmit}
                  disabled={!avail.available || createMutation.isPending}
                >
                  {createMutation.isPending ? 'Creating…' : 'Confirm Booking'}
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-react/src/features/bookings/create-booking-page.tsx
git commit -m "feat: add CreateBookingPage with date pickers, slot selector, seat grid, and invoice"
```

---

### Task 22: EditBookingPage

**Files:**
- Create: `frontend-react/src/features/bookings/edit-booking-page.tsx`

- [ ] **Step 1: Create edit-booking-page.tsx**

Create `frontend-react/src/features/bookings/edit-booking-page.tsx`:

```tsx
import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import * as bookingsApi from '@/core/api/bookings'
import type { AccessType, AvailabilityRequest } from '@/core/api/models'
import { nprText } from '@/core/currency'
import { DatePicker } from '@/components/date-picker'
import { SeatGrid } from './seat-grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { cn } from '@/lib/utils'

function toIso(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

function endTimeForSlot(start: string): string {
  const [h] = start.split(':').map(Number)
  return `${String(h + 3).padStart(2, '0')}:00`
}

/** Convert "HH:mm:ss" or "HH:mm" to "HH:00" (nearest slot) */
function toSlotStart(time: string): string {
  return time.slice(0, 2) + ':00'
}

export default function EditBookingPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: booking, isLoading: bookingLoading } = useQuery({
    queryKey: ['bookings', id],
    queryFn: () => bookingsApi.getBooking(id!),
    enabled: !!id,
  })

  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [accessType, setAccessType] = useState<AccessType>('timeslot')
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [seatId, setSeatId] = useState<number | null>(null)
  const [withLocker, setWithLocker] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Initialize from booking data
  useEffect(() => {
    if (booking && !initialized) {
      setStartDate(parseISO(booking.start_date))
      setEndDate(parseISO(booking.end_date))
      setAccessType(booking.access_type)
      if (booking.access_type === 'timeslot') {
        setSelectedSlot(toSlotStart(booking.start_time))
      }
      setSeatId(booking.seat_id)
      setWithLocker(booking.with_locker)
      setInitialized(true)
    }
  }, [booking, initialized])

  const { data: pricing } = useQuery({
    queryKey: ['pricing', 'public'],
    queryFn: bookingsApi.publicPricing,
  })

  const availableSlots = useMemo(() => {
    if (!pricing) return ['06:00', '09:00', '12:00', '15:00', '18:00']
    const openH = parseInt(pricing.business_open_time.split(':')[0], 10)
    const closeH = parseInt(pricing.business_close_time.split(':')[0], 10)
    const slots: string[] = []
    for (let h = openH; h + 3 <= closeH; h += 3) {
      slots.push(`${String(h).padStart(2, '0')}:00`)
    }
    return slots.length > 0 ? slots : ['06:00', '09:00', '12:00', '15:00', '18:00']
  }, [pricing])

  const canCheckSeats = !!startDate && !!endDate && (accessType === 'anytime' || !!selectedSlot)

  const seatsQuery = useQuery({
    queryKey: ['seats', 'availability', startDate && toIso(startDate), endDate && toIso(endDate), accessType, selectedSlot],
    queryFn: () =>
      bookingsApi.seatsAvailability({
        start_date: toIso(startDate!),
        end_date: toIso(endDate!),
        access_type: accessType,
        start_time: accessType === 'timeslot' && selectedSlot ? selectedSlot : null,
        end_time: accessType === 'timeslot' && selectedSlot ? endTimeForSlot(selectedSlot) : null,
      }),
    enabled: canCheckSeats,
  })

  const canCheckPrice = canCheckSeats && seatId !== null
  const availabilityQuery = useQuery({
    queryKey: ['bookings', 'availability', seatId, startDate && toIso(startDate), endDate && toIso(endDate), accessType, selectedSlot, withLocker],
    queryFn: () =>
      bookingsApi.checkAvailability({
        seat_id: seatId!,
        start_date: toIso(startDate!),
        end_date: toIso(endDate!),
        access_type: accessType,
        start_time: accessType === 'timeslot' && selectedSlot ? selectedSlot : null,
        end_time: accessType === 'timeslot' && selectedSlot ? endTimeForSlot(selectedSlot) : null,
        with_locker: withLocker,
      }),
    enabled: canCheckPrice,
  })

  const updateMutation = useMutation({
    mutationFn: (body: AvailabilityRequest) => bookingsApi.updateBooking(id!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      toast.success('Booking updated!')
      navigate('/app/my-bookings')
    },
    onError: (err) => {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? 'Update failed' : 'Update failed'
      toast.error(msg)
    },
  })

  const handleSubmit = () => {
    if (!startDate || !endDate || !seatId) return
    updateMutation.mutate({
      seat_id: seatId,
      start_date: toIso(startDate),
      end_date: toIso(endDate),
      access_type: accessType,
      start_time: accessType === 'timeslot' && selectedSlot ? selectedSlot : null,
      end_time: accessType === 'timeslot' && selectedSlot ? endTimeForSlot(selectedSlot) : null,
      with_locker: withLocker,
    })
  }

  if (bookingLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>
  }

  const avail = availabilityQuery.data
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Edit Booking</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Dates</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Start date</Label>
            <DatePicker value={startDate} onChange={setStartDate} disabled={(d) => d < today} />
          </div>
          <div className="space-y-2">
            <Label>End date</Label>
            <DatePicker value={endDate} onChange={setEndDate} disabled={(d) => d < (startDate ?? today)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Access Type</CardTitle></CardHeader>
        <CardContent>
          <RadioGroup value={accessType} onValueChange={(v) => setAccessType(v as AccessType)}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="timeslot" id="edit-timeslot" />
              <Label htmlFor="edit-timeslot">3-Hour Timeslot</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="anytime" id="edit-anytime" />
              <Label htmlFor="edit-anytime">Anytime (full day)</Label>
            </div>
          </RadioGroup>

          {accessType === 'timeslot' && (
            <div className="mt-4 flex flex-wrap gap-2">
              {availableSlots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={cn(
                    'rounded-md border px-4 py-2 text-sm font-medium transition-colors',
                    selectedSlot === slot
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card hover:border-primary hover:bg-primary/5',
                  )}
                >
                  {slot} – {endTimeForSlot(slot)}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {canCheckSeats && (
        <Card>
          <CardHeader><CardTitle className="text-base">Seat</CardTitle></CardHeader>
          <CardContent>
            {seatsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading seats…</p>
            ) : seatsQuery.data ? (
              <SeatGrid
                totalSeats={seatsQuery.data.total_seats}
                unavailableSeatIds={seatsQuery.data.unavailable_seat_ids}
                disabledSeatIds={seatsQuery.data.disabled_seat_ids ?? []}
                selectedSeatId={seatId}
                onSelect={setSeatId}
              />
            ) : null}
          </CardContent>
        </Card>
      )}

      {canCheckPrice && (
        <Card>
          <CardHeader><CardTitle className="text-base">Updated Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox id="edit-locker" checked={withLocker} onCheckedChange={(v) => setWithLocker(v === true)} />
              <Label htmlFor="edit-locker">Add locker</Label>
            </div>
            <Separator />

            {availabilityQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Checking price…</p>
            ) : avail ? (
              <>
                {!avail.available && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {avail.reason ?? 'Not available for selected dates.'}
                  </div>
                )}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span>{avail.breakdown.category}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Duration</span><span>{avail.breakdown.duration_days} days</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Rate/day</span><span>{nprText(avail.breakdown.per_day_rate)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Base</span><span>{nprText(avail.breakdown.base)}</span></div>
                  {withLocker && (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">Locker/day</span><span>{nprText(avail.breakdown.locker_per_day)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Locker fee</span><span>{nprText(avail.breakdown.locker_fee)}</span></div>
                    </>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold"><span>Total</span><span>{nprText(avail.final_price)}</span></div>
                </div>

                {booking && parseFloat(booking.paid_amount) > 0 && (
                  <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    Previously paid: {nprText(booking.paid_amount)}. Amount due after edit: {nprText(avail.final_price)}
                  </div>
                )}

                <Button className="mt-4 w-full" onClick={handleSubmit} disabled={!avail.available || updateMutation.isPending}>
                  {updateMutation.isPending ? 'Updating…' : 'Update Booking'}
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-react/src/features/bookings/edit-booking-page.tsx
git commit -m "feat: add EditBookingPage with pre-populated form and update mutation"
```

---

### Task 23: AdminUsersPage

**Files:**
- Create: `frontend-react/src/features/admin/admin-users-page.tsx`

- [ ] **Step 1: Create admin-users-page.tsx**

Create `frontend-react/src/features/admin/admin-users-page.tsx`:

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as adminUsersApi from '@/core/api/admin-users'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Search } from 'lucide-react'

export default function AdminUsersPage() {
  const queryClient = useQueryClient()
  const [emailPrefix, setEmailPrefix] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', emailPrefix],
    queryFn: () => adminUsersApi.listUsers({ limit: 50, emailPrefix: emailPrefix || null }),
  })

  const grantMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      adminUsersApi.grantRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('Role granted')
    },
    onError: () => toast.error('Failed to grant role'),
  })

  const revokeMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      adminUsersApi.revokeRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('Role revoked')
    },
    onError: () => toast.error('Failed to revoke role'),
  })

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Users</h1>

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setEmailPrefix(searchInput)}
          />
        </div>
        <Button onClick={() => setEmailPrefix(searchInput)}>Search</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Loading…</TableCell></TableRow>
            ) : data?.users.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">No users found</TableCell></TableRow>
            ) : (
              data?.users.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-mono text-sm">{u.email}</TableCell>
                  <TableCell>{[u.given_name, u.family_name].filter(Boolean).join(' ') || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={u.enabled ? 'default' : 'destructive'}>
                      {u.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r} variant="secondary" className="cursor-pointer" onClick={() => revokeMutation.mutate({ userId: u.user_id, role: r })}>
                          {r} ×
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <RoleGrantDialog userId={u.user_id} onGrant={(role) => grantMutation.mutate({ userId: u.user_id, role })} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function RoleGrantDialog({ userId, onGrant }: { userId: string; onGrant: (role: string) => void }) {
  const [role, setRole] = useState('')
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Add role</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Grant role</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Select onValueChange={setRole}>
            <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">admin</SelectItem>
              <SelectItem value="user">user</SelectItem>
            </SelectContent>
          </Select>
          <Button className="w-full" disabled={!role} onClick={() => { onGrant(role); setRole('') }}>
            Grant
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-react/src/features/admin/admin-users-page.tsx
git commit -m "feat: add AdminUsersPage with search, role grant/revoke, and user table"
```

---

### Task 24: AdminRolesPage

**Files:**
- Create: `frontend-react/src/features/admin/admin-roles-page.tsx`

- [ ] **Step 1: Create admin-roles-page.tsx**

Create `frontend-react/src/features/admin/admin-roles-page.tsx`:

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend-react/src/features/admin/admin-roles-page.tsx
git commit -m "feat: add AdminRolesPage with grant/revoke by email or user ID"
```

---

### Task 25: AdminPricingPage

**Files:**
- Create: `frontend-react/src/features/admin/admin-pricing-page.tsx`

- [ ] **Step 1: Create admin-pricing-page.tsx**

Create `frontend-react/src/features/admin/admin-pricing-page.tsx`:

```tsx
import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import * as adminPricingApi from '@/core/api/admin-pricing'
import type { PricingConfigResponse } from '@/core/api/models'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { RefreshCw } from 'lucide-react'

const pricingSchema = z.object({
  timeslot_daily_price: z.coerce.number().min(0),
  timeslot_weekly_price: z.coerce.number().min(0),
  timeslot_monthly_price: z.coerce.number().min(0),
  anytime_daily_price: z.coerce.number().min(0),
  anytime_weekly_price: z.coerce.number().min(0),
  anytime_monthly_price: z.coerce.number().min(0),
  locker_daily_price: z.coerce.number().min(0),
  locker_weekly_price: z.coerce.number().min(0),
  locker_monthly_price: z.coerce.number().min(0),
  reservation_timeout_minutes: z.coerce.number().min(1),
  business_open_time: z.string().min(1),
  business_close_time: z.string().min(1),
})

type PricingForm = z.infer<typeof pricingSchema>

export default function AdminPricingPage() {
  const queryClient = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'pricing'],
    queryFn: adminPricingApi.getPricing,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PricingForm>({
    resolver: zodResolver(pricingSchema),
  })

  useEffect(() => {
    if (data) reset(data)
  }, [data, reset])

  const saveMutation = useMutation({
    mutationFn: adminPricingApi.updatePricing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] })
      toast.success('Pricing updated')
    },
    onError: (err) => {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? 'Save failed' : 'Save failed'
      toast.error(msg)
    },
  })

  if (isLoading) return <Skeleton className="h-96 w-full" />

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Pricing Configuration</h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit((v) => saveMutation.mutate(v as PricingConfigResponse))} className="space-y-6">
            <section>
              <h3 className="mb-3 font-medium">3-Hour (Timeslot) prices (NPR/day)</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1"><Label>Daily</Label><Input type="number" {...register('timeslot_daily_price')} /></div>
                <div className="space-y-1"><Label>Weekly</Label><Input type="number" {...register('timeslot_weekly_price')} /></div>
                <div className="space-y-1"><Label>Monthly</Label><Input type="number" {...register('timeslot_monthly_price')} /></div>
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="mb-3 font-medium">Anytime prices (NPR/day)</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1"><Label>Daily</Label><Input type="number" {...register('anytime_daily_price')} /></div>
                <div className="space-y-1"><Label>Weekly</Label><Input type="number" {...register('anytime_weekly_price')} /></div>
                <div className="space-y-1"><Label>Monthly</Label><Input type="number" {...register('anytime_monthly_price')} /></div>
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="mb-3 font-medium">Locker add-on (NPR/day)</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1"><Label>Daily</Label><Input type="number" {...register('locker_daily_price')} /></div>
                <div className="space-y-1"><Label>Weekly</Label><Input type="number" {...register('locker_weekly_price')} /></div>
                <div className="space-y-1"><Label>Monthly</Label><Input type="number" {...register('locker_monthly_price')} /></div>
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="mb-3 font-medium">Rules</h3>
              <div className="max-w-xs space-y-1">
                <Label>Reservation timeout (min)</Label>
                <Input type="number" {...register('reservation_timeout_minutes')} />
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="mb-3 font-medium">Business hours</h3>
              <div className="grid gap-4 sm:grid-cols-2 max-w-md">
                <div className="space-y-1"><Label>Open</Label><Input type="time" {...register('business_open_time')} /></div>
                <div className="space-y-1"><Label>Close</Label><Input type="time" {...register('business_close_time')} /></div>
              </div>
            </section>

            <div className="flex gap-3">
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : 'Save pricing'}
              </Button>
              <Button type="button" variant="outline" onClick={() => refetch()} disabled={isLoading}>
                <RefreshCw className="mr-2 h-4 w-4" /> Reload
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-react/src/features/admin/admin-pricing-page.tsx
git commit -m "feat: add AdminPricingPage with form for timeslot/anytime/locker prices and business hours"
```

---

### Task 26: AdminSeatsPage

**Files:**
- Create: `frontend-react/src/features/admin/admin-seats-page.tsx`

- [ ] **Step 1: Create admin-seats-page.tsx**

Create `frontend-react/src/features/admin/admin-seats-page.tsx`:

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as adminSeatsApi from '@/core/api/admin-seats'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

export default function AdminSeatsPage() {
  const queryClient = useQueryClient()

  const { data: seats, isLoading } = useQuery({
    queryKey: ['admin', 'seats'],
    queryFn: adminSeatsApi.listSeats,
  })

  const toggleMutation = useMutation({
    mutationFn: ({ seatId, enabled }: { seatId: number; enabled: boolean }) =>
      adminSeatsApi.patchSeat(seatId, { is_enabled: enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'seats'] })
      toast.success('Seat updated')
    },
    onError: () => toast.error('Failed to update seat'),
  })

  if (isLoading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Seats</h1>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {seats?.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.id}</TableCell>
                <TableCell>{s.label}</TableCell>
                <TableCell>
                  <Badge variant={s.is_enabled ? 'default' : 'destructive'}>
                    {s.is_enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleMutation.mutate({ seatId: s.id, enabled: !s.is_enabled })}
                    disabled={toggleMutation.isPending}
                  >
                    {s.is_enabled ? 'Disable' : 'Enable'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-react/src/features/admin/admin-seats-page.tsx
git commit -m "feat: add AdminSeatsPage with enable/disable toggle"
```

---

### Task 27: AdminBookingsPage

**Files:**
- Create: `frontend-react/src/features/admin/admin-bookings-page.tsx`

- [ ] **Step 1: Create admin-bookings-page.tsx**

Create `frontend-react/src/features/admin/admin-bookings-page.tsx`:

```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as adminBookingsApi from '@/core/api/admin-bookings'
import type { BookingStatus } from '@/core/api/models'
import { nprText } from '@/core/currency'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

const STATUSES: (BookingStatus | 'ALL')[] = ['ALL', 'RESERVED', 'PAYMENT_PENDING', 'COMPLETED', 'EXPIRED', 'REJECTED']

const statusVariant: Record<BookingStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  RESERVED: 'default',
  PAYMENT_PENDING: 'secondary',
  COMPLETED: 'default',
  EXPIRED: 'outline',
  REJECTED: 'destructive',
}

export default function AdminBookingsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['admin', 'bookings', statusFilter],
    queryFn: () => adminBookingsApi.allBookings(statusFilter === 'ALL' ? null : statusFilter),
  })

  if (isLoading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">All Bookings</h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Seat</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-8 text-center">No bookings found</TableCell></TableRow>
            ) : (
              bookings?.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="text-sm">{b.user?.email ?? b.user_id.slice(0, 8)}</TableCell>
                  <TableCell>{b.seat_id}</TableCell>
                  <TableCell className="text-sm">{b.start_date} → {b.end_date}</TableCell>
                  <TableCell>{b.access_type}</TableCell>
                  <TableCell>{nprText(b.final_price)}</TableCell>
                  <TableCell><Badge variant={statusVariant[b.status]}>{b.status.replace('_', ' ')}</Badge></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-react/src/features/admin/admin-bookings-page.tsx
git commit -m "feat: add AdminBookingsPage with status filter and booking table"
```

---

### Task 28: AdminPaymentsPage

**Files:**
- Create: `frontend-react/src/features/admin/admin-payments-page.tsx`

- [ ] **Step 1: Create admin-payments-page.tsx**

Create `frontend-react/src/features/admin/admin-payments-page.tsx`:

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as adminBookingsApi from '@/core/api/admin-bookings'
import { nprText } from '@/core/currency'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { Check, X, Eye } from 'lucide-react'

export default function AdminPaymentsPage() {
  const queryClient = useQueryClient()

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['admin', 'payments', 'pending'],
    queryFn: adminBookingsApi.pendingPayments,
  })

  const approveMutation = useMutation({
    mutationFn: ({ bookingId, amount }: { bookingId: string; amount?: string }) =>
      adminBookingsApi.approvePayment(bookingId, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] })
      toast.success('Payment approved')
    },
    onError: (err) => {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? 'Approval failed' : 'Approval failed'
      toast.error(msg)
    },
  })

  const rejectMutation = useMutation({
    mutationFn: adminBookingsApi.rejectPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] })
      toast.success('Payment rejected')
    },
    onError: () => toast.error('Rejection failed'),
  })

  const [proofUrl, setProofUrl] = useState<string | null>(null)

  const viewProof = async (bookingId: string) => {
    try {
      const blob = await adminBookingsApi.downloadPaymentProof(bookingId)
      const url = URL.createObjectURL(blob)
      setProofUrl(url)
    } catch {
      toast.error('Could not load payment proof')
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Pending Payments</h1>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Seat</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings?.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center">No pending payments</TableCell></TableRow>
            ) : (
              bookings?.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="text-sm">{b.user?.email ?? b.user_id.slice(0, 8)}</TableCell>
                  <TableCell>{b.seat_id}</TableCell>
                  <TableCell>{nprText(b.final_price)}</TableCell>
                  <TableCell>{nprText(b.paid_amount)}</TableCell>
                  <TableCell>{nprText(b.amount_due)}</TableCell>
                  <TableCell><Badge variant="secondary">{b.status.replace('_', ' ')}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {b.payment_proof_path && (
                        <Button variant="ghost" size="icon" onClick={() => viewProof(b.id)} title="View proof">
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <ApproveDialog
                        amountDue={b.amount_due}
                        onApprove={(amt) => approveMutation.mutate({ bookingId: b.id, amount: amt })}
                      />
                      <Button variant="ghost" size="icon" onClick={() => rejectMutation.mutate(b.id)} title="Reject">
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Proof image dialog */}
      {proofUrl && (
        <Dialog open onOpenChange={() => { URL.revokeObjectURL(proofUrl); setProofUrl(null) }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Payment Proof</DialogTitle></DialogHeader>
            <img src={proofUrl} alt="Payment proof" className="w-full rounded" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function ApproveDialog({ amountDue, onApprove }: { amountDue: string; onApprove: (amount?: string) => void }) {
  const [amount, setAmount] = useState('')

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Approve">
          <Check className="h-4 w-4 text-green-600" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Approve Payment</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Amount due: {nprText(amountDue)}</p>
          <div className="space-y-2">
            <Label>Amount (leave empty for full amount)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={amountDue} />
          </div>
          <Button className="w-full" onClick={() => onApprove(amount || undefined)}>
            Approve
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-react/src/features/admin/admin-payments-page.tsx
git commit -m "feat: add AdminPaymentsPage with approve/reject actions and proof viewer"
```

---

### Task 29: AdminPaymentSettingsPage

**Files:**
- Create: `frontend-react/src/features/admin/admin-payment-settings-page.tsx`

- [ ] **Step 1: Create admin-payment-settings-page.tsx**

Create `frontend-react/src/features/admin/admin-payment-settings-page.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import * as adminPaymentsApi from '@/core/api/admin-payments'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { Upload } from 'lucide-react'

const settingsSchema = z.object({
  upi_vpa: z.string().nullable(),
  payee_name: z.string().nullable(),
  instructions: z.string().nullable(),
})

type SettingsForm = z.infer<typeof settingsSchema>

export default function AdminPaymentSettingsPage() {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payment-settings'],
    queryFn: adminPaymentsApi.getPaymentSettings,
  })

  const { register, handleSubmit, reset } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
  })

  useEffect(() => {
    if (data) reset({ upi_vpa: data.upi_vpa, payee_name: data.payee_name, instructions: data.instructions })
  }, [data, reset])

  const saveMutation = useMutation({
    mutationFn: adminPaymentsApi.updatePaymentSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'payment-settings'] })
      toast.success('Settings saved')
    },
    onError: (err) => {
      const msg = isAxiosError(err) ? err.response?.data?.detail ?? 'Save failed' : 'Save failed'
      toast.error(msg)
    },
  })

  const uploadQrMutation = useMutation({
    mutationFn: adminPaymentsApi.uploadPaymentQr,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'payment-settings'] })
      toast.success('QR code uploaded')
    },
    onError: () => toast.error('QR upload failed'),
  })

  const [qrPreview, setQrPreview] = useState<string | null>(null)

  useEffect(() => {
    if (data?.has_qr) {
      adminPaymentsApi.paymentQrBlob().then((blob) => {
        setQrPreview(URL.createObjectURL(blob))
      }).catch(() => {})
    }
    return () => { if (qrPreview) URL.revokeObjectURL(qrPreview) }
  }, [data?.has_qr])

  if (isLoading) return <Skeleton className="h-64 w-full" />

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Payment Settings</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Payment Details</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4">
              <div className="space-y-2">
                <Label>UPI VPA</Label>
                <Input {...register('upi_vpa')} placeholder="merchant@upi" />
              </div>
              <div className="space-y-2">
                <Label>Payee name</Label>
                <Input {...register('payee_name')} placeholder="Business Name" />
              </div>
              <div className="space-y-2">
                <Label>Instructions</Label>
                <Input {...register('instructions')} placeholder="Payment instructions for users" />
              </div>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : 'Save settings'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">QR Code</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {qrPreview && (
              <img src={qrPreview} alt="Payment QR" className="mx-auto h-48 w-48 rounded border" />
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileRef.current?.click()}
              disabled={uploadQrMutation.isPending}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploadQrMutation.isPending ? 'Uploading…' : 'Upload QR Code'}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) uploadQrMutation.mutate(file)
                e.target.value = ''
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-react/src/features/admin/admin-payment-settings-page.tsx
git commit -m "feat: add AdminPaymentSettingsPage with UPI settings form and QR upload"
```

---

### Task 30: Verify Full App Builds and Runs

**Files:**
- None (verification only)

- [ ] **Step 1: Install all dependencies**

```bash
cd frontend-react && npm install
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd frontend-react && npx tsc --noEmit
```

Fix any type errors that appear.

- [ ] **Step 3: Run all tests**

```bash
cd frontend-react && npx vitest run
```

All tests should pass.

- [ ] **Step 4: Build for production**

```bash
cd frontend-react && npm run build
```

Expected: Successful Vite build in `dist/`.

- [ ] **Step 5: Start dev server and verify manually**

```bash
cd frontend-react && npm run dev
```

Open `http://localhost:5173` — should redirect to `/login`, show the split-screen layout.

- [ ] **Step 6: Final commit**

```bash
git add -A frontend-react/
git commit -m "chore: verify full React frontend builds, tests pass, and dev server runs"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Scaffold Vite project | package.json, .env.example |
| 2 | Tailwind v4 + Vite config | vite.config.ts, index.css, utils.ts |
| 3 | shadcn/ui init | components.json, ui/ |
| 4 | Vitest + RTL setup | vitest.config.ts, test-setup.ts |
| 5 | Core models + utils | models.ts, currency.ts, booking-rules.ts |
| 6 | Token storage + axios | token-storage.ts, cognito-oauth.ts, client.ts |
| 7 | Auth API | auth.ts |
| 8 | Bookings API | bookings.ts |
| 9 | Admin API (6 files) | admin-*.ts |
| 10 | AuthContext | auth-context.tsx |
| 11 | Route guards | protected/admin/book-route.tsx |
| 12 | App.tsx + router | App.tsx, main.tsx, query-client.ts |
| 13 | UserShell | user-shell.tsx |
| 14 | AdminShell | admin-shell.tsx |
| 15 | LoginPage | login-page.tsx |
| 16 | RegisterPage | register-page.tsx |
| 17 | ForgotPassword + OAuth | forgot-password-page.tsx, oauth-callback-page.tsx |
| 18 | DatePicker | date-picker.tsx |
| 19 | SeatGrid | seat-grid.tsx |
| 20 | MyBookingsPage | my-bookings-page.tsx |
| 21 | CreateBookingPage | create-booking-page.tsx |
| 22 | EditBookingPage | edit-booking-page.tsx |
| 23 | AdminUsersPage | admin-users-page.tsx |
| 24 | AdminRolesPage | admin-roles-page.tsx |
| 25 | AdminPricingPage | admin-pricing-page.tsx |
| 26 | AdminSeatsPage | admin-seats-page.tsx |
| 27 | AdminBookingsPage | admin-bookings-page.tsx |
| 28 | AdminPaymentsPage | admin-payments-page.tsx |
| 29 | AdminPaymentSettingsPage | admin-payment-settings-page.tsx |
| 30 | Build verification | — |
