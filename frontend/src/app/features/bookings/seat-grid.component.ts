import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';

interface Seat {
  id: number;
  x: number;
  y: number;
}

const SEAT_W = 22;
const SEAT_H = 20;
/** Container dimensions derived from the furthest seat coordinate + seat size + padding. */
const GRID_WIDTH = 360;
const GRID_HEIGHT = 500;

const SEAT_POSITIONS: Seat[] = [
  { id: 1, x: 111.52, y: 76.21 },
  { id: 2, x: 136.52, y: 76.21 },
  { id: 3, x: 161.52, y: 76.21 },
  { id: 4, x: 211.52, y: 76.21 },
  { id: 5, x: 236.52, y: 76.21 },
  { id: 6, x: 111.52, y: 101.21 },
  { id: 7, x: 136.52, y: 101.21 },
  { id: 8, x: 161.52, y: 101.21 },
  { id: 9, x: 211.52, y: 101.21 },
  { id: 10, x: 236.52, y: 101.21 },
  { id: 11, x: 111.52, y: 151.21 },
  { id: 12, x: 136.52, y: 151.21 },
  { id: 13, x: 186.52, y: 151.21 },
  { id: 14, x: 211.52, y: 151.21 },
  { id: 15, x: 271.52, y: 151.21 },
  { id: 16, x: 296.52, y: 151.21 },
  { id: 17, x: 111.52, y: 176.21 },
  { id: 18, x: 136.52, y: 176.21 },
  { id: 19, x: 186.52, y: 176.21 },
  { id: 20, x: 211.52, y: 176.21 },
  { id: 21, x: 271.52, y: 176.21 },
  { id: 22, x: 296.52, y: 176.21 },
  { id: 23, x: 111.52, y: 201.21 },
  { id: 24, x: 136.52, y: 201.21 },
  { id: 25, x: 186.52, y: 201.21 },
  { id: 26, x: 211.52, y: 201.21 },
  { id: 27, x: 158.59, y: 225.28 },
  { id: 28, x: 185.83, y: 225.28 },
  { id: 29, x: 225.83, y: 225.28 },
  { id: 30, x: 275.83, y: 225.28 },
  { id: 31, x: 300.83, y: 225.28 },
  { id: 32, x: 185.92, y: 251.21 },
  { id: 33, x: 225.92, y: 251.21 },
  { id: 34, x: 275.91, y: 251.21 },
  { id: 35, x: 300.91, y: 251.21 },
  { id: 36, x: 185.92, y: 276.21 },
  { id: 37, x: 225.92, y: 276.21 },
  { id: 38, x: 275.91, y: 276.21 },
  { id: 39, x: 300.91, y: 276.21 },
  { id: 40, x: 271.62, y: 126.65 },
  { id: 41, x: 296.61, y: 126.04 },
  { id: 42, x: 210.92, y: 321.21 },
  { id: 43, x: 235.92, y: 321.21 },
  { id: 44, x: 285.91, y: 321.21 },
  { id: 45, x: 310.91, y: 321.21 },
  { id: 46, x: 210.92, y: 346.21 },
  { id: 47, x: 235.92, y: 346.21 },
  { id: 48, x: 285.91, y: 346.21 },
  { id: 49, x: 310.91, y: 346.21 },
  { id: 50, x: 210.92, y: 371.21 },
  { id: 51, x: 235.92, y: 371.21 },
  { id: 52, x: 285.91, y: 371.21 },
  { id: 53, x: 310.91, y: 371.21 },
  { id: 54, x: 210.83, y: 395.55 },
  { id: 55, x: 235.83, y: 395.55 },
  { id: 56, x: 285.83, y: 395.55 },
  { id: 57, x: 310.83, y: 395.55 },
  { id: 58, x: 210.83, y: 420.55 },
  { id: 59, x: 235.83, y: 420.55 },
  { id: 60, x: 285.83, y: 420.55 },
  { id: 61, x: 310.83, y: 420.55 },
  { id: 62, x: 210.83, y: 455.55 },
  { id: 63, x: 235.83, y: 455.55 },
  { id: 64, x: 285.83, y: 445.55 },
  { id: 65, x: 310.83, y: 445.55 },
];

@Component({
  selector: 'zv-seat-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatTooltipModule],
  template: `
    <div class="seat-grid">
      <div
        class="grid-container"
        role="listbox"
        [attr.aria-label]="'Seat selector'"
        [style.width.px]="GRID_WIDTH"
        [style.height.px]="GRID_HEIGHT"
      >
        <div class="screen-bar"><span>ENTRANCE</span></div>

        @for (seat of seats; track seat.id) {
          <button
            type="button"
            class="seat"
            role="option"
            [style.left.px]="seat.x"
            [style.top.px]="seat.y"
            [class.unavailable]="unavailableSet().has(seat.id)"
            [class.selected]="selected() === seat.id"
            [disabled]="unavailableSet().has(seat.id) || disabled()"
            [attr.aria-selected]="selected() === seat.id"
            [matTooltip]="tooltipFor(seat)"
            matTooltipPosition="above"
            (click)="pick(seat.id)"
          >
            {{ seat.id }}
          </button>
        }
      </div>

      <div class="legend" aria-label="Seat legend">
        <span class="chip"><span class="swatch available"></span>Available</span>
        <span class="chip"><span class="swatch selected"></span>Selected</span>
        <span class="chip"><span class="swatch unavailable"></span>Booked</span>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .seat-grid {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        padding: 20px 8px 8px;
        overflow-x: hidden;
      }
      .grid-container {
        position: relative;
        overflow: visible;
        transform-origin: top center;
        flex-shrink: 0;
      }
      .screen-bar {
        position: absolute;
        top: 296px;
        left: 111.52px;
        width: 74px;
        text-align: center;
        font-size: 10px;
        letter-spacing: 1px;
        font-weight: 600;
        color: #64748b;
        padding: 4px 6px;
        white-space: nowrap;
        overflow: hidden;
        background: rgba(124, 58, 237, 0.08);
        border: 1px solid rgba(124, 58, 237, 0.35);
        border-radius: 4px;
        box-shadow: 0 1px 4px -2px rgba(124, 58, 237, 0.4);
      }
      .seat {
        all: unset;
        box-sizing: border-box;
        position: absolute;
        width: ${SEAT_W}px;
        height: ${SEAT_H}px;
        border-radius: 6px 6px 3px 3px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font: 600 10px/1 "Inter", system-ui, sans-serif;
        font-variant-numeric: tabular-nums;
        color: #334155;
        background: #e2e8f0;
        border: 1px solid rgba(15, 23, 42, 0.08);
        cursor: pointer;
        transition: background 0.12s ease, transform 0.08s ease,
          box-shadow 0.15s ease, color 0.12s ease;
      }
      .seat:hover:not(:disabled):not(.selected) {
        background: #c7d2fe;
        color: #1e1b4b;
        transform: translateY(-1px);
      }
      .seat:active:not(:disabled) {
        transform: translateY(0);
      }
      .seat.selected {
        background: linear-gradient(135deg, #7c3aed, #6d5efc);
        color: #fff;
        border-color: transparent;
        box-shadow: 0 4px 10px -4px rgba(109, 94, 252, 0.65);
      }
      .seat.unavailable,
      .seat:disabled {
        background: repeating-linear-gradient(
          45deg,
          #f1f5f9,
          #f1f5f9 4px,
          #e2e8f0 4px,
          #e2e8f0 8px
        );
        color: #cbd5e1;
        cursor: not-allowed;
        box-shadow: none;
        transform: none;
      }
      .legend {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        margin-top: 4px;
        font-size: 12px;
        color: #475569;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .swatch {
        display: inline-block;
        width: 14px;
        height: 14px;
        border-radius: 4px 4px 2px 2px;
        border: 1px solid rgba(15, 23, 42, 0.08);
      }
      .swatch.available {
        background: #e2e8f0;
      }
      .swatch.selected {
        background: linear-gradient(135deg, #7c3aed, #6d5efc);
        border-color: transparent;
      }
      .swatch.unavailable {
        background: repeating-linear-gradient(
          45deg,
          #f1f5f9,
          #f1f5f9 4px,
          #e2e8f0 4px,
          #e2e8f0 8px
        );
      }

      /* Scale the entire fixed-coordinate grid to fit smaller screens.
         margin-bottom compensates for the height no longer consumed after scaling
         (transform does not affect layout flow). Formula: 500px * (scale - 1). */
      @media (max-width: 480px) {
        .grid-container {
          transform: scale(0.85);
          margin-bottom: -75px;
        }
      }
      @media (max-width: 380px) {
        .grid-container {
          transform: scale(0.75);
          margin-bottom: -125px;
        }
      }
      @media (max-width: 320px) {
        .grid-container {
          transform: scale(0.65);
          margin-bottom: -175px;
        }
      }
    `,
  ],
})
export class SeatGridComponent {
  readonly unavailable = input<readonly number[]>([]);
  readonly selected = input<number | null>(null);
  readonly disabled = input<boolean>(false);

  readonly selectedChange = output<number>();

  /** 65-seat-aisle pattern, north stage. Each seat placed at its absolute (x, y) pixel coordinate. */
  readonly seats: readonly Seat[] = SEAT_POSITIONS;

  readonly GRID_WIDTH = GRID_WIDTH;
  readonly GRID_HEIGHT = GRID_HEIGHT;

  readonly unavailableSet = computed(() => new Set(this.unavailable()));

  tooltipFor(seat: Seat): string {
    if (this.unavailableSet().has(seat.id)) {
      return `Seat ${seat.id} · Booked`;
    }
    return `Seat ${seat.id}`;
  }

  pick(id: number): void {
    if (this.unavailableSet().has(id) || this.disabled()) return;
    this.selectedChange.emit(id);
  }
}
