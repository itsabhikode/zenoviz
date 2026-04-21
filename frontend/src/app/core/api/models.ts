export interface LoginTokens {
  access_token: string;
  refresh_token: string;
}

export interface RefreshTokenResponse {
  access_token: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  given_name: string;
  family_name: string;
  phone_number: string;
  gender: 'male' | 'female' | 'other';
}

export interface RegisterResponse {
  message: string;
  user_sub: string;
  user_confirmed: boolean;
  verification_destination: string | null;
  delivery_medium: string | null;
}

export interface ForgotPasswordResponse {
  message: string;
  verification_destination: string | null;
  delivery_medium: string | null;
}

export interface ApiMessageResponse {
  message: string;
}

export interface MeResponse {
  user_id: string;
  email: string;
  roles: string[];
  given_name?: string | null;
  family_name?: string | null;
  phone_number?: string | null;
}

// Bookings
export type AccessType = 'timeslot' | 'anytime';
export type BookingStatus =
  | 'RESERVED'
  | 'PAYMENT_PENDING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'EXPIRED';
export type PriceCategory = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'daily' | 'weekly' | 'monthly';

export interface AvailabilityRequest {
  seat_id: number;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  access_type: AccessType;
  start_time?: string | null; // HH:mm
  end_time?: string | null;
}

/**
 * Shape matches backend `PriceBreakdownResponse`. Backend returns all monetary
 * fields as strings (serialised Decimals) to preserve precision across the wire.
 */
export interface PriceBreakdown {
  category: string;
  access_type: string;
  base_price: string;
  discount_percent: string;
  discounted_price: string;
  anytime_surcharge_percent: string;
  surcharge: string;
  final_price: string;
}

/** Shape matches backend `AvailabilityCheckResponse`. */
export interface AvailabilityResponse {
  available: boolean;
  reason: string | null;
  duration_days: number;
  category: string;
  final_price: string;
  breakdown: PriceBreakdown;
}

export interface CreateBookingRequest extends AvailabilityRequest {}

/** Shape matches backend `SeatsAvailabilityRequest` (same as AvailabilityRequest sans seat_id). */
export interface SeatsAvailabilityRequest {
  start_date: string;
  end_date: string;
  access_type: AccessType;
  start_time?: string | null;
  end_time?: string | null;
}

/** Shape matches backend `SeatsAvailabilityResponse`. */
export interface SeatsAvailabilityResponse {
  total_seats: number;
  unavailable_seat_ids: number[];
  /** Seats turned off by admin (subset of unavailable when calendar is open). */
  disabled_seat_ids?: number[];
}

/** Shape matches backend `BookingResponse`. */
export interface UserSummary {
  user_id: string;
  email: string | null;
  given_name: string | null;
  family_name: string | null;
  phone_number: string | null;
}

export interface BookingResponse {
  id: string;
  user_id: string;
  seat_id: number;
  start_date: string;
  end_date: string;
  access_type: AccessType;
  start_time: string;
  end_time: string;
  category: string;
  duration_days: number;
  status: BookingStatus;
  reserved_until: string | null;
  final_price: string;
  /** Cumulative amount admin has approved against this booking (server-computed). */
  paid_amount: string;
  /** final_price - paid_amount (clamped at 0); what the user still owes. */
  amount_due: string;
  breakdown: PriceBreakdown;
  payment_proof_path: string | null;
  created_at: string;
  updated_at: string | null;
  /**
   * Populated only for admin-facing endpoints. Regular user endpoints leave
   * this null — admins need the name/email/phone, users just see their own.
   */
  user?: UserSummary | null;
}

// Admin pricing
export interface PricingConfigResponse {
  daily_base_price: number;
  weekly_base_price: number;
  monthly_base_price: number;
  daily_discount_percent: number;
  weekly_discount_percent: number;
  monthly_discount_percent: number;
  anytime_surcharge_percent: number;
  reservation_timeout_minutes: number;
  business_open_time: string; // HH:mm
  business_close_time: string;
}

export interface UpdatePricingRequest extends PricingConfigResponse {}

export interface SeatResponse {
  id: number;
  label: string;
  is_enabled: boolean;
}

export interface UpdateSeatEnabledRequest {
  is_enabled: boolean;
}

export interface PaymentSettingsResponse {
  upi_vpa: string | null;
  payee_name: string | null;
  instructions: string | null;
  has_qr: boolean;
  qr_content_type: string | null;
  /** When set, use as image src; otherwise fetch QR bytes from the API. */
  qr_public_url?: string | null;
  updated_at: string | null;
}

export interface UpdatePaymentSettingsRequest {
  upi_vpa: string | null;
  payee_name: string | null;
  instructions: string | null;
}

// Admin users
export interface UserAdminSummary {
  user_id: string;
  username: string;
  email: string | null;
  email_verified: boolean;
  given_name: string | null;
  family_name: string | null;
  phone_number: string | null;
  status: string;
  enabled: boolean;
  created_at: string | null;
  roles: string[];
}

export interface ListUsersResponse {
  users: UserAdminSummary[];
  next_pagination_token: string | null;
}

// Admin roles
export interface RoleMutationRequest {
  user_id?: string;
  email?: string;
  role: string;
}

export interface RoleAssignmentResponse {
  user_id: string;
  role: string;
  changed: boolean;
}

export interface UserRolesResponse {
  user_id: string;
  roles: string[];
}

export interface RoleUsersResponse {
  role: string;
  user_ids: string[];
}
