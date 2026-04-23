import { BreakpointObserver } from '@angular/cdk/layout';
import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
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
import { UserBookingPolicyService } from '../booking/user-booking-policy.service';

interface NavItem {
  label: string;
  icon: string;
  path: string;
}

@Component({
  selector: 'zv-user-shell',
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
        #drawer
        class="sidenav"
        [mode]="isHandset() ? 'over' : 'side'"
        [opened]="!isHandset() || drawerOpen()"
        (openedChange)="onDrawerOpened($event)"
        [fixedInViewport]="true"
      >
        <div class="brand">
          <div class="brand-mark">
            <mat-icon>event_seat</mat-icon>
          </div>
          <div class="brand-text">
            <span class="brand-name">Zenoviz</span>
            <small class="brand-tag">Study room</small>
          </div>
        </div>
        <nav class="nav">
          @for (item of navItems(); track item.path) {
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
          <div class="user-chip">
            <mat-icon>account_circle</mat-icon>
            <div class="meta">
              <span class="name">{{ auth.displayName() }}</span>
              @if (auth.displayEmail(); as email) {
                <span class="email">{{ email }}</span>
              }
              @if (isAdmin()) {
                <span class="role-chip">Admin</span>
              }
            </div>
          </div>
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
            <span class="crumb-eyebrow">Zenoviz</span>
            <h1 class="crumb-title">{{ pageTitle() }}</h1>
          </div>
          <span class="zv-spacer"></span>

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
                @if (isAdmin()) {
                  <small class="role-chip">admin</small>
                }
              </div>
            </div>
            <mat-divider />
            @if (isAdmin()) {
              <button mat-menu-item type="button" (click)="goToAdminConsole()">
                <mat-icon>admin_panel_settings</mat-icon>
                <span>Admin console</span>
              </button>
              <mat-divider />
            }
            <button mat-menu-item type="button" (click)="logout()">
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
        width: min(280px, 88vw);
        padding: max(16px, env(safe-area-inset-top, 0px)) 12px 20px;
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.94) 0%,
          rgba(250, 248, 255, 0.94) 100%
        );
        backdrop-filter: saturate(1.2) blur(12px);
        border-right: 1px solid rgba(15, 23, 42, 0.06);
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
      }
      .brand-tag {
        font-size: 11px;
        color: var(--mat-sys-on-surface-variant);
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
        color: var(--mat-sys-on-surface);
        text-decoration: none;
        font-size: 14px;
        font-weight: 500;
        letter-spacing: -0.005em;
        transition:
          background 0.15s ease,
          color 0.15s ease,
          transform 0.1s ease;
      }
      .nav-item:hover {
        background: rgba(124, 58, 237, 0.06);
      }
      .nav-item:active {
        transform: translateY(1px);
      }
      .nav-item mat-icon {
        color: var(--mat-sys-on-surface-variant);
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
        border-top: 1px solid rgba(15, 23, 42, 0.06);
      }
      .user-chip {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        border-radius: 10px;
        background: rgba(15, 23, 42, 0.04);
      }
      .user-chip .meta {
        display: flex;
        flex-direction: column;
        overflow: hidden;
        min-width: 0;
      }
      .user-chip .name {
        font-size: 13px;
        font-weight: 600;
        color: #0f172a;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .user-chip .email {
        font-size: 11px;
        font-weight: 400;
        color: var(--mat-sys-on-surface-variant);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
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
        background: rgba(255, 255, 255, 0.82);
        backdrop-filter: saturate(1.4) blur(14px);
        border-bottom: 1px solid rgba(15, 23, 42, 0.06);
      }
      .menu-btn {
        flex-shrink: 0;
      }
      .crumb {
        display: flex;
        flex-direction: column;
        line-height: 1.1;
        min-width: 0;
      }
      .crumb-eyebrow {
        font-size: 10px;
        color: var(--mat-sys-on-surface-variant);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 500;
      }
      .crumb-title {
        margin: 2px 0 0 0;
        font-size: clamp(15px, 3.5vw, 17px);
        font-weight: 600;
        letter-spacing: -0.015em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .zv-spacer {
        flex: 1;
      }
      .avatar-btn {
        flex-shrink: 0;
        background: rgba(15, 23, 42, 0.04);
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
        background: rgba(124, 58, 237, 0.12);
        color: #6d28d9;
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
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        padding-bottom: env(safe-area-inset-bottom, 0px);
      }
    `,
  ],
})
export class UserShellComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly bookingPolicy = inject(UserBookingPolicyService);
  private readonly router = inject(Router);
  private readonly breakpoint = inject(BreakpointObserver);

  readonly isHandset = toSignal(
    this.breakpoint.observe('(max-width: 959px)').pipe(map((r) => r.matches)),
    { initialValue: false },
  );
  readonly drawerOpen = signal(false);

  readonly navItems = computed(() => {
    const items: NavItem[] = [
      { label: 'My Bookings', icon: 'event_available', path: '/app/my-bookings' },
    ];
    if (!this.bookingPolicy.blocksNewBooking()) {
      items.push({ label: 'Book a Seat', icon: 'add_circle', path: '/app/book' });
    }
    return items;
  });

  readonly isAdmin = computed(
    () => this.auth.currentUser()?.roles.includes('admin') ?? false,
  );
  readonly pageTitle = signal('Dashboard');

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
        this.bookingPolicy.refreshFromApi();
      });
  }

  ngOnInit(): void {
    this.auth.me().subscribe({ error: () => void 0 });
    this.bookingPolicy.refreshFromApi();
    this.router.events.subscribe(() => {
      const match = this.navItems().find((n) => this.router.url.startsWith(n.path));
      this.pageTitle.set(match ? match.label : 'Dashboard');
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

  goToAdminConsole(): void {
    this.router.navigate(['/admin']);
  }

  logout(): void {
    this.auth.logout();
  }
}
