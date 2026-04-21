import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  BookingResponse,
  PaymentSettingsResponse,
  PricingConfigResponse,
  SeatResponse,
  UpdatePaymentSettingsRequest,
  UpdatePricingRequest,
  UpdateSeatEnabledRequest,
} from './models';

@Injectable({ providedIn: 'root' })
export class AdminStudyService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/admin/study-room`;

  getPricing(): Observable<PricingConfigResponse> {
    return this.http.get<PricingConfigResponse>(`${this.base}/pricing`);
  }

  updatePricing(body: UpdatePricingRequest): Observable<PricingConfigResponse> {
    return this.http.put<PricingConfigResponse>(`${this.base}/pricing`, body);
  }

  listSeats(): Observable<SeatResponse[]> {
    return this.http.get<SeatResponse[]>(`${this.base}/seats`);
  }

  patchSeat(seatId: number, body: UpdateSeatEnabledRequest): Observable<SeatResponse> {
    return this.http.patch<SeatResponse>(`${this.base}/seats/${seatId}`, body);
  }

  pendingPayments(): Observable<BookingResponse[]> {
    return this.http.get<BookingResponse[]>(`${this.base}/bookings/pending-payments`);
  }

  /** Authenticated fetch of stored payment-proof image (local or S3-backed). */
  downloadPaymentProof(bookingId: string): Observable<Blob> {
    return this.http.get(`${this.base}/bookings/${bookingId}/payment-proof`, {
      responseType: 'blob',
    });
  }

  /**
   * Fetch every booking in the system. Optionally filter by status — accepts the
   * uppercase wire format (e.g. "RESERVED", "PAYMENT_PENDING"). Backend normalises
   * case-insensitively.
   */
  allBookings(statusFilter?: string | null): Observable<BookingResponse[]> {
    const url = `${this.base}/bookings`;
    const params = statusFilter ? { status: statusFilter } : undefined;
    return this.http.get<BookingResponse[]>(url, params ? { params } : {});
  }

  /**
   * Credit an admin-verified payment to the booking. `amount` is what the
   * admin read off the UPI screenshot — omit it to default to "whatever is
   * still owed" (the clean-path exact-match case).
   */
  approvePayment(bookingId: string, amount?: string): Observable<BookingResponse> {
    const body = amount != null ? { amount } : {};
    return this.http.post<BookingResponse>(
      `${this.base}/bookings/${bookingId}/approve`,
      body,
    );
  }

  rejectPayment(bookingId: string): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(
      `${this.base}/bookings/${bookingId}/reject`,
      {},
    );
  }

  getPaymentSettings(): Observable<PaymentSettingsResponse> {
    return this.http.get<PaymentSettingsResponse>(`${this.base}/payment-settings`);
  }

  updatePaymentSettings(
    body: UpdatePaymentSettingsRequest,
  ): Observable<PaymentSettingsResponse> {
    return this.http.put<PaymentSettingsResponse>(
      `${this.base}/payment-settings`,
      body,
    );
  }

  uploadPaymentQr(file: File): Observable<PaymentSettingsResponse> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<PaymentSettingsResponse>(
      `${this.base}/payment-settings/qr`,
      fd,
    );
  }

  paymentQrBlob(): Observable<Blob> {
    return this.http.get(
      `${environment.apiBaseUrl}/study-room/payment-settings/qr`,
      { responseType: 'blob' },
    );
  }
}
