import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BookingsService } from '../../core/api/bookings.service';
import { PricingConfigResponse } from '../../core/api/models';

@Component({
  selector: 'zv-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">

      <div class="banner">

        <div class="header">
          <div>
            <p class="brand-label">ZenoViz</p>
            <p class="banner-title">Study Room pricing</p>
          </div>
          <span class="currency-pill">All rates in NPR · per day</span>
        </div>

        @if (loading()) {
          <div class="loading-row">Loading pricing…</div>
        }

        @if (!loading() && pricing()) {
          <div class="grid">

            <div class="cell-label"></div>
            <div class="cell col-header">
              <p class="col-label">Daily</p>
            </div>
            <div class="cell col-header col-header-weekly">
              <p class="col-label">Weekly</p>
              @if (weeklyAnytimeSaving() > 0) {
                <p class="save-tag">Save {{ weeklyAnytimeSaving() }}%</p>
              }
            </div>
            <div class="cell col-header">
              <p class="col-label">Monthly</p>
              @if (monthlyAnytimeSaving() > 0) {
                <p class="save-tag">Save {{ monthlyAnytimeSaving() }}%</p>
              }
            </div>

            <!-- Anytime row -->
            <div class="plan-label-cell">
              <p class="plan-name">Anytime</p>
              <span class="popular-badge">Popular</span>
              <p class="plan-sub">Unlimited hours</p>
            </div>
            <div class="price-cell">
              <p class="price-main">{{ pricing()!.anytime_daily_price }}</p>
              <p class="price-sub">per day</p>
            </div>
            <div class="price-cell price-cell-weekly">
              <p class="price-main">{{ pricing()!.anytime_weekly_price }}</p>
              <p class="price-sub">per day</p>
              <p class="price-period">{{ pricing()!.anytime_weekly_price * 7 | number:'1.0-0' }} / week</p>
            </div>
            <div class="price-cell">
              <p class="price-main">{{ pricing()!.anytime_monthly_price }}</p>
              <p class="price-sub">per day</p>
              <p class="price-period">{{ pricing()!.anytime_monthly_price * 30 | number:'1.0-0' }} / month</p>
            </div>

            <!-- 3-hour slot row -->
            <div class="plan-label-cell divider-strong">
              <p class="plan-name">3-hour slot</p>
              <p class="plan-sub">One session / day</p>
            </div>
            <div class="price-cell divider-strong">
              <p class="price-main">{{ pricing()!.timeslot_daily_price }}</p>
              <p class="price-sub">per day</p>
            </div>
            <div class="price-cell price-cell-weekly divider-strong">
              <p class="price-main">{{ pricing()!.timeslot_weekly_price }}</p>
              <p class="price-sub">per day</p>
              <p class="price-period">{{ pricing()!.timeslot_weekly_price * 7 | number:'1.0-0' }} / week</p>
            </div>
            <div class="price-cell divider-strong">
              <p class="price-main">{{ pricing()!.timeslot_monthly_price }}</p>
              <p class="price-sub">per day</p>
              <p class="price-period">{{ pricing()!.timeslot_monthly_price * 30 | number:'1.0-0' }} / month</p>
            </div>

            <!-- Locker add-on row -->
            <div class="addon-label-cell">
              <p class="addon-name">+ Locker</p>
              <p class="addon-sub">Optional add-on</p>
            </div>
            <div class="addon-price-cell">
              <p class="addon-price">+ {{ pricing()!.locker_daily_price }}</p>
              <p class="addon-price-sub">per day</p>
            </div>
            <div class="addon-price-cell addon-price-cell-weekly">
              <p class="addon-price">+ {{ pricing()!.locker_weekly_price }}</p>
              <p class="addon-price-sub">per day</p>
            </div>
            <div class="addon-price-cell">
              <p class="addon-price">+ {{ pricing()!.locker_monthly_price }}</p>
              <p class="addon-price-sub">per day</p>
            </div>

          </div>

          <div class="footer">
            <p class="footer-label">All plans include:</p>
            <div class="features">
              <span class="feature-tag">High-speed Wi-Fi</span>
              <span class="feature-tag">Charging stations</span>
              <span class="feature-tag">Drinking water</span>
              <span class="feature-tag">Open seating</span>
            </div>
          </div>
        }

      </div>

      <div class="cta">
        <a routerLink="/login" class="cta-btn">Book a seat</a>
      </div>

    </div>
  `,
  styles: [`
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .page {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f4f3ef;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      gap: 1.5rem;
    }

    .banner {
      background: #ffffff;
      border: 0.5px solid rgba(0,0,0,0.12);
      border-radius: 14px;
      overflow: hidden;
      width: 100%;
      max-width: 680px;
    }

    .loading-row {
      padding: 2rem;
      text-align: center;
      color: #aaa;
      font-size: 14px;
    }

    .header {
      padding: 1.25rem 1.5rem;
      border-bottom: 0.5px solid rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }

    .brand-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #999;
      margin-bottom: 3px;
    }

    .banner-title {
      font-size: 20px;
      font-weight: 500;
      color: #1a1a1a;
    }

    .currency-pill {
      font-size: 12px;
      color: #888;
      background: #f4f3ef;
      padding: 4px 10px;
      border-radius: 8px;
      border: 0.5px solid rgba(0,0,0,0.1);
    }

    .grid {
      display: grid;
      grid-template-columns: 150px repeat(3, minmax(0, 1fr));
    }

    .cell {
      padding: 10px 1rem;
      border-bottom: 0.5px solid rgba(0,0,0,0.08);
    }

    .cell-label {
      padding: 10px 1.25rem;
      border-right: 0.5px solid rgba(0,0,0,0.08);
      border-bottom: 0.5px solid rgba(0,0,0,0.08);
    }

    .col-header { text-align: center; }

    .col-header-weekly {
      background: #f7f6f2;
      border-left: 0.5px solid rgba(0,0,0,0.08);
      border-right: 0.5px solid rgba(0,0,0,0.08);
    }

    .col-label {
      font-size: 13px;
      font-weight: 500;
      color: #1a1a1a;
    }

    .save-tag {
      font-size: 11px;
      color: #1D9E75;
      margin-top: 2px;
    }

    .plan-label-cell {
      padding: 1rem 1.25rem;
      border-right: 0.5px solid rgba(0,0,0,0.08);
      border-bottom: 0.5px solid rgba(0,0,0,0.08);
    }

    .plan-name {
      font-size: 14px;
      font-weight: 500;
      color: #1a1a1a;
      margin-bottom: 5px;
    }

    .popular-badge {
      font-size: 11px;
      background: #E6F1FB;
      color: #185FA5;
      padding: 2px 8px;
      border-radius: 6px;
      display: inline-block;
    }

    .plan-sub {
      font-size: 11px;
      color: #888;
      margin-top: 6px;
    }

    .price-cell {
      padding: 1rem;
      text-align: center;
      border-bottom: 0.5px solid rgba(0,0,0,0.08);
    }

    .price-cell-weekly {
      background: #f7f6f2;
      border-left: 0.5px solid rgba(0,0,0,0.08);
      border-right: 0.5px solid rgba(0,0,0,0.08);
    }

    .price-main {
      font-size: 26px;
      font-weight: 500;
      color: #1a1a1a;
      line-height: 1;
    }

    .price-sub {
      font-size: 11px;
      color: #888;
      margin-top: 4px;
    }

    .price-period {
      font-size: 11px;
      color: #bbb;
      margin-top: 2px;
    }

    .divider-strong {
      border-bottom: 0.5px solid rgba(0,0,0,0.15);
    }

    .addon-label-cell {
      padding: 0.875rem 1.25rem;
      border-right: 0.5px solid rgba(0,0,0,0.08);
      background: #f7f6f2;
    }

    .addon-name {
      font-size: 12px;
      font-weight: 500;
      color: #666;
    }

    .addon-sub {
      font-size: 11px;
      color: #aaa;
      margin-top: 2px;
    }

    .addon-price-cell {
      padding: 0.875rem 1rem;
      text-align: center;
      background: #f7f6f2;
    }

    .addon-price-cell-weekly {
      border-left: 0.5px solid rgba(0,0,0,0.08);
      border-right: 0.5px solid rgba(0,0,0,0.08);
    }

    .addon-price {
      font-size: 18px;
      font-weight: 500;
      color: #888;
    }

    .addon-price-sub {
      font-size: 11px;
      color: #bbb;
      margin-top: 3px;
    }

    .footer {
      padding: 0.875rem 1.5rem;
      border-top: 0.5px solid rgba(0,0,0,0.08);
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .footer-label {
      font-size: 11px;
      color: #bbb;
      flex-shrink: 0;
    }

    .features {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .feature-tag {
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 6px;
      background: #f4f3ef;
      color: #888;
      border: 0.5px solid rgba(0,0,0,0.08);
    }

    .cta {
      width: 100%;
      max-width: 680px;
      display: flex;
      justify-content: flex-end;
    }

    .cta-btn {
      background: #1a1a1a;
      color: #fff;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      padding: 10px 24px;
      border-radius: 8px;
    }

    .cta-btn:hover {
      background: #333;
    }
  `],
})
export class HomeComponent implements OnInit {
  private readonly bookings = inject(BookingsService);

  readonly loading = signal(true);
  readonly pricing = signal<PricingConfigResponse | null>(null);

  ngOnInit(): void {
    this.bookings.publicPricing().subscribe({
      next: (p) => {
        this.pricing.set(p);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  weeklyAnytimeSaving(): number {
    const p = this.pricing();
    if (!p || p.anytime_daily_price === 0) return 0;
    return Math.round((1 - p.anytime_weekly_price / p.anytime_daily_price) * 100);
  }

  monthlyAnytimeSaving(): number {
    const p = this.pricing();
    if (!p || p.anytime_daily_price === 0) return 0;
    return Math.round((1 - p.anytime_monthly_price / p.anytime_daily_price) * 100);
  }
}
