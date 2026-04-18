import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AvailabilityRequest,
  AvailabilityResponse,
  BookingResponse,
  CreateBookingRequest,
  PaymentSettingsResponse,
  SeatsAvailabilityRequest,
  SeatsAvailabilityResponse,
} from './models';

@Injectable({ providedIn: 'root' })
export class BookingsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/study-room`;

  checkAvailability(body: AvailabilityRequest): Observable<AvailabilityResponse> {
    return this.http.post<AvailabilityResponse>(`${this.base}/availability`, body);
  }

  seatsAvailability(body: SeatsAvailabilityRequest): Observable<SeatsAvailabilityResponse> {
    return this.http.post<SeatsAvailabilityResponse>(`${this.base}/seats/availability`, body);
  }

  create(body: CreateBookingRequest): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(`${this.base}/bookings`, body);
  }

  /**
   * Replace an existing booking with new seat/dates/slot. Backend applies the
   * delta rules: edits before payment are free; post-payment edits must be the
   * same tier or an upgrade (top-up invoiced via `amount_due`).
   */
  update(bookingId: string, body: CreateBookingRequest): Observable<BookingResponse> {
    return this.http.put<BookingResponse>(`${this.base}/bookings/${bookingId}`, body);
  }

  getOne(bookingId: string): Observable<BookingResponse> {
    return this.http.get<BookingResponse>(`${this.base}/bookings/${bookingId}`);
  }

  mine(): Observable<BookingResponse[]> {
    return this.http.get<BookingResponse[]>(`${this.base}/bookings`);
  }

  uploadPaymentProof(bookingId: string, file: File): Observable<BookingResponse> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<BookingResponse>(
      `${this.base}/bookings/${bookingId}/payment-proof`,
      form,
    );
  }

  paymentSettings(): Observable<PaymentSettingsResponse> {
    return this.http.get<PaymentSettingsResponse>(`${this.base}/payment-settings`);
  }

  paymentQrBlob(): Observable<Blob> {
    return this.http.get(`${this.base}/payment-settings/qr`, {
      responseType: 'blob',
    });
  }
}
