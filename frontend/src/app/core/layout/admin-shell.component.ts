import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { AuthService } from '../api/auth.service';

interface NavItem {
  label: string;
  /** Short label for bottom navigation on small screens */
  short: string;
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
      <mat-sidenav
        class="sidenav"
        [mode]="isHandset() ? 'over' : 'side'"
        [opened]="!isHandset() || drawerOpen()"
        (openedChange)="onDrawerOpened($event)"
        [fixedInViewport]="true"
      >
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
              (click)="closeDrawerOnNavigate()"
            >
              <mat-icon>{{ item.icon }}</mat-icon>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>
        <div class="sidenav-footer">
          <button type="button" class="exit-card" (click)="exitToApp()">
            <mat-icon>exit_to_app</mat-icon>
            <div>
              <span class="exit-title">Exit console</span>
              <small>Back to user app</small>
            </div>
          </button>
        </div>
      </mat-sidenav>

      <mat-sidenav-content class="sidenav-content">
        <header class="topbar">
          @if (isHandset()) {
            <button
              mat-icon-button
              type="button"
              (click)="toggleDrawer()"
              aria-label="Open menu"
              class="menu-btn"
            >
              <mat-icon>menu</mat-icon>
            </button>
          }
          <div class="crumb">
            <span class="crumb-eyebrow">
              <mat-icon class="crumb-icon">admin_panel_settings</mat-icon>
              Admin
            </span>
            <h1 class="crumb-title">{{ pageTitle() }}</h1>
          </div>
          <span class="zv-spacer"></span>

          @if (!isHandset()) {
            <button mat-stroked-button type="button" (click)="exitToApp()" class="exit-btn">
              <mat-icon>exit_to_app</mat-icon>
              Exit
            </button>
          }

          <button
            mat-icon-button
            type="button"
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
            <button mat-menu-item type="button" (click)="exitToApp()">
              <mat-icon>exit_to_app</mat-icon>
              <span>Back to user app</span>
            </button>
            <button mat-menu-item type="button" (click)="logout()">
              <mat-icon>logout</mat-icon>
              <span>Sign out</span>
            </button>
          </mat-menu>
        </header>

        <main class="content" [class.content--nav]="isHandset()">
          <router-outlet />
        </main>

        @if (isHandset()) {
          <nav class="bottom-nav" aria-label="Admin sections">
            <div class="bottom-nav__scroll">
              @for (item of nav; track item.path) {
                <a
                  class="bottom-nav__item"
                  [routerLink]="item.path"
                  routerLinkActive="active"
                  [routerLinkActiveOptions]="{ exact: false }"
                  (click)="closeDrawerOnNavigate()"
                >
                  <mat-icon class="bottom-nav__icon">{{ item.icon }}</mat-icon>
                  <span class="bottom-nav__label">{{ item.short }}</span>
                </a>
              }
            </div>
          </nav>
        }
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100vh;
        height: 100dvh;
      }
      .shell {
        height: 100vh;
        height: 100dvh;
        background: transparent;
      }
      .sidenav-content {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .sidenav {
        width: min(288px, 90vw);
        padding: max(16px, env(safe-area-inset-top, 0px)) 12px 20px;
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
        min-height: 48px;
        padding: 0 14px;
        border-radius: 10px;
        color: rgba(248, 250, 252, 0.82);
        text-decoration: none;
        font-size: 14px;
        font-weight: 500;
        transition:
          background 0.15s ease,
          color 0.15s ease,
          transform 0.1s ease;
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
        font-size: 22px;
        width: 22px;
        height: 22px;
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
        flex-shrink: 0;
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: max(10px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px))
          10px max(12px, env(safe-area-inset-left, 0px));
        background: rgba(15, 23, 42, 0.94);
        backdrop-filter: saturate(1.4) blur(14px);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        color: #f8fafc;
      }
      .menu-btn {
        flex-shrink: 0;
        color: #f8fafc;
      }
      .crumb {
        display: flex;
        flex-direction: column;
        line-height: 1.1;
        min-width: 0;
      }
      .crumb-eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 10px;
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
        font-size: clamp(14px, 3.5vw, 16px);
        font-weight: 600;
        letter-spacing: -0.015em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .zv-spacer {
        flex: 1;
      }
      .exit-btn {
        flex-shrink: 0;
        color: #f8fafc !important;
        border-color: rgba(255, 255, 255, 0.2) !important;
      }
      .avatar-btn {
        flex-shrink: 0;
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
        flex: 1;
        min-height: 0;
        overflow-x: clip;
      }
      .content--nav {
        padding-bottom: calc(52px + env(safe-area-inset-bottom, 0px));
      }

      .bottom-nav {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 9;
        background: rgba(15, 23, 42, 0.96);
        backdrop-filter: saturate(1.2) blur(14px);
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        padding-bottom: env(safe-area-inset-bottom, 0px);
      }
      .bottom-nav__scroll {
        display: flex;
        flex-wrap: nowrap;
        gap: 2px;
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior-x: contain;
        scrollbar-width: none;
        padding: 6px 8px;
        min-height: calc(48px + env(safe-area-inset-bottom, 0px));
      }
      .bottom-nav__scroll::-webkit-scrollbar {
        display: none;
      }
      .bottom-nav__item {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        min-width: 72px;
        max-width: 96px;
        padding: 6px 8px;
        border-radius: 10px;
        text-decoration: none;
        color: rgba(226, 232, 240, 0.65);
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.02em;
        text-align: center;
        line-height: 1.15;
      }
      .bottom-nav__item.active {
        color: #fff;
        background: rgba(124, 58, 237, 0.35);
      }
      .bottom-nav__icon {
        font-size: 22px !important;
        width: 22px !important;
        height: 22px !important;
      }
      .bottom-nav__label {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        word-break: break-word;
      }
    `,
  ],
})
export class AdminShellComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly breakpoint = inject(BreakpointObserver);

  readonly isHandset = toSignal(
    this.breakpoint.observe('(max-width: 959px)').pipe(map((r) => r.matches)),
    { initialValue: false },
  );
  readonly drawerOpen = signal(false);

  readonly nav: NavItem[] = [
    { label: 'Users', short: 'Users', icon: 'people', path: '/admin/users' },
    { label: 'Roles', short: 'Roles', icon: 'admin_panel_settings', path: '/admin/roles' },
    { label: 'All Bookings', short: 'Bookings', icon: 'event_note', path: '/admin/bookings' },
    {
      label: 'Pending Payments',
      short: 'Pending',
      icon: 'receipt_long',
      path: '/admin/payments',
    },
    { label: 'Pricing', short: 'Price', icon: 'payments', path: '/admin/pricing' },
    { label: 'Seats', short: 'Seats', icon: 'event_seat', path: '/admin/seats' },
    { label: 'Payment QR', short: 'QR', icon: 'qr_code_2', path: '/admin/payment-settings' },
  ];

  readonly pageTitle = signal('Overview');

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (this.isHandset()) {
          this.drawerOpen.set(false);
        }
      });
  }

  ngOnInit(): void {
    this.auth.me().subscribe({ error: () => void 0 });
    this.router.events.subscribe(() => {
      const match = this.nav.find((n) => this.router.url.startsWith(n.path));
      this.pageTitle.set(match ? match.label : 'Overview');
    });
  }

  toggleDrawer(): void {
    this.drawerOpen.update((v) => !v);
  }

  onDrawerOpened(opened: boolean): void {
    if (this.isHandset()) {
      this.drawerOpen.set(opened);
    }
  }

  closeDrawerOnNavigate(): void {
    if (this.isHandset()) {
      this.drawerOpen.set(false);
    }
  }

  exitToApp(): void {
    this.router.navigate(['/app']);
  }

  logout(): void {
    this.auth.logout();
  }
}
