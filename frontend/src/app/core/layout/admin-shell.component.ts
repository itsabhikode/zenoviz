import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../api/auth.service';

interface NavItem {
  label: string;
  icon: string;
  path: string;
}

@Component({
  selector: 'zv-admin-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
    MatTooltipModule,
  ],
  template: `
    <mat-sidenav-container class="shell" autosize>
      <mat-sidenav #drawer mode="side" opened class="sidenav">
        <div class="brand">
          <div class="brand-mark">
            <mat-icon>admin_panel_settings</mat-icon>
          </div>
          <div class="brand-text">
            <span class="brand-name">Zenoviz</span>
            <small class="brand-tag">Admin console</small>
          </div>
        </div>
        <nav class="nav">
          @for (item of nav; track item.path) {
            <a
              class="nav-item"
              [routerLink]="item.path"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: false }"
            >
              <mat-icon>{{ item.icon }}</mat-icon>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>
        <div class="sidenav-footer">
          <button class="exit-card" (click)="exitToApp()">
            <mat-icon>exit_to_app</mat-icon>
            <div>
              <span class="exit-title">Exit console</span>
              <small>Back to user app</small>
            </div>
          </button>
        </div>
      </mat-sidenav>

      <mat-sidenav-content>
        <header class="topbar">
          <button
            mat-icon-button
            (click)="drawer.toggle()"
            aria-label="Toggle menu"
            class="menu-btn"
          >
            <mat-icon>menu</mat-icon>
          </button>
          <div class="crumb">
            <span class="crumb-eyebrow">
              <mat-icon class="crumb-icon">admin_panel_settings</mat-icon>
              Admin console
            </span>
            <h1 class="crumb-title">{{ pageTitle() }}</h1>
          </div>
          <span class="zv-spacer"></span>

          <button mat-stroked-button (click)="exitToApp()" class="exit-btn">
            <mat-icon>exit_to_app</mat-icon>
            Exit
          </button>

          <button
            mat-icon-button
            [matMenuTriggerFor]="userMenu"
            matTooltip="Account"
            aria-label="Account menu"
            class="avatar-btn"
          >
            <mat-icon>account_circle</mat-icon>
          </button>
          <mat-menu #userMenu="matMenu" xPosition="before">
            <div class="menu-header" (click)="$event.stopPropagation()">
              <div class="menu-avatar">
                <mat-icon>account_circle</mat-icon>
              </div>
              <div class="menu-meta">
                <div class="name">{{ auth.displayName() }}</div>
                @if (auth.displayEmail(); as email) {
                  <div class="email">{{ email }}</div>
                }
                <small class="role-chip">admin</small>
              </div>
            </div>
            <mat-divider />
            <button mat-menu-item (click)="exitToApp()">
              <mat-icon>exit_to_app</mat-icon>
              <span>Back to user app</span>
            </button>
            <button mat-menu-item (click)="logout()">
              <mat-icon>logout</mat-icon>
              <span>Sign out</span>
            </button>
          </mat-menu>
        </header>

        <main class="content">
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100vh;
      }
      .shell {
        height: 100vh;
        background: transparent;
      }
      .sidenav {
        width: 260px;
        padding: 20px 12px;
        background: var(--zv-gradient-admin);
        color: #e2e8f0;
        border-right: 1px solid rgba(255, 255, 255, 0.06);
        display: flex;
        flex-direction: column;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 4px 10px 18px;
      }
      .brand-mark {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: var(--zv-gradient-brand);
        display: grid;
        place-items: center;
        color: #fff;
        box-shadow: 0 8px 20px -8px rgba(109, 94, 252, 0.6);
      }
      .brand-mark mat-icon {
        color: #fff;
      }
      .brand-text {
        display: flex;
        flex-direction: column;
        line-height: 1.1;
      }
      .brand-name {
        font-size: 17px;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: #f8fafc;
      }
      .brand-tag {
        font-size: 11px;
        color: rgba(248, 250, 252, 0.6);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .nav {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin-top: 8px;
      }
      .nav-item {
        display: flex;
        align-items: center;
        gap: 12px;
        height: 44px;
        padding: 0 14px;
        border-radius: 10px;
        color: rgba(248, 250, 252, 0.82);
        text-decoration: none;
        font-size: 14px;
        font-weight: 500;
        transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;
      }
      .nav-item:hover {
        background: rgba(255, 255, 255, 0.06);
        color: #fff;
      }
      .nav-item:active {
        transform: translateY(1px);
      }
      .nav-item mat-icon {
        color: rgba(248, 250, 252, 0.6);
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
      .nav-item.active {
        background: var(--zv-gradient-brand);
        color: #fff;
        box-shadow: 0 6px 16px -8px rgba(109, 94, 252, 0.55);
      }
      .nav-item.active mat-icon {
        color: #fff;
      }
      .sidenav-footer {
        margin-top: auto;
        padding-top: 12px;
      }
      .exit-card {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 10px 12px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #e2e8f0;
        font-family: inherit;
        cursor: pointer;
        text-align: left;
        transition: background 0.15s ease;
      }
      .exit-card:hover {
        background: rgba(255, 255, 255, 0.08);
      }
      .exit-card mat-icon {
        color: rgba(248, 250, 252, 0.8);
      }
      .exit-title {
        display: block;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.2;
      }
      .exit-card small {
        display: block;
        font-size: 11px;
        color: rgba(248, 250, 252, 0.55);
      }
      .topbar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 28px;
        background: rgba(15, 23, 42, 0.94);
        backdrop-filter: saturate(1.4) blur(14px);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        color: #f8fafc;
      }
      .menu-btn {
        display: none;
        color: #f8fafc;
      }
      @media (max-width: 900px) {
        .menu-btn {
          display: inline-flex;
        }
      }
      .crumb {
        display: flex;
        flex-direction: column;
        line-height: 1.1;
      }
      .crumb-eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: #c4b5fd;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 600;
      }
      .crumb-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }
      .crumb-title {
        margin: 2px 0 0 0;
        font-size: 16px;
        font-weight: 600;
        letter-spacing: -0.015em;
      }
      .zv-spacer {
        flex: 1;
      }
      .exit-btn {
        color: #f8fafc !important;
        border-color: rgba(255, 255, 255, 0.2) !important;
      }
      .avatar-btn {
        background: rgba(255, 255, 255, 0.08);
        color: #f8fafc;
      }
      .menu-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px 10px;
      }
      .menu-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--zv-gradient-brand);
        display: grid;
        place-items: center;
        color: #fff;
      }
      .menu-avatar mat-icon {
        color: #fff;
      }
      .menu-meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .menu-meta .name {
        font-size: 14px;
        font-weight: 600;
        color: #0f172a;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .menu-meta .email {
        font-size: 12px;
        font-weight: 400;
        color: var(--mat-sys-on-surface-variant);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .role-chip {
        background: rgba(124, 58, 237, 0.18);
        color: #c4b5fd;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        width: fit-content;
      }
      .content {
        min-height: calc(100vh - 64px);
      }
    `,
  ],
})
export class AdminShellComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly nav: NavItem[] = [
    { label: 'Users', icon: 'people', path: '/admin/users' },
    { label: 'Roles', icon: 'admin_panel_settings', path: '/admin/roles' },
    { label: 'All Bookings', icon: 'event_note', path: '/admin/bookings' },
    { label: 'Pending Payments', icon: 'receipt_long', path: '/admin/payments' },
    { label: 'Pricing', icon: 'payments', path: '/admin/pricing' },
    { label: 'Payment QR', icon: 'qr_code_2', path: '/admin/payment-settings' },
  ];

  readonly pageTitle = signal('Overview');

  ngOnInit(): void {
    this.auth.me().subscribe({ error: () => void 0 });
    this.router.events.subscribe(() => {
      const match = this.nav.find((n) => this.router.url.startsWith(n.path));
      this.pageTitle.set(match ? match.label : 'Overview');
    });
  }

  exitToApp(): void {
    this.router.navigate(['/app']);
  }

  logout(): void {
    this.auth.logout();
  }
}
