import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';

interface Cell {
  id: number;
  row: string;
  col: number;
}

const ROWS = 5;
const COLS = 13;
const ROW_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;

@Component({
  selector: 'zv-seat-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatTooltipModule],
  template: `
    <div class="seat-grid">
      <div class="screen-bar">
        <span>ENTRANCE</span>
      </div>

      <div class="grid-wrap" role="listbox" [attr.aria-label]="'Seat selector'">
        @for (row of rows; track row.label) {
          <div class="grid-row">
            <span class="row-label">{{ row.label }}</span>
            @for (cell of row.cells; track cell.id) {
              <button
                type="button"
                class="seat"
                role="option"
                [class.unavailable]="unavailableSet().has(cell.id)"
                [class.selected]="selected() === cell.id"
                [disabled]="unavailableSet().has(cell.id) || disabled()"
                [attr.aria-selected]="selected() === cell.id"
                [matTooltip]="tooltipFor(cell)"
                matTooltipPosition="above"
                (click)="pick(cell.id)"
              >
                {{ cell.id }}
              </button>
              @if (shouldInsertAisle(cell.col)) {
                <span class="aisle" aria-hidden="true"></span>
              }
            }
            <span class="row-label">{{ row.label }}</span>
          </div>
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
      }
      .screen-bar {
        width: min(560px, 100%);
        text-align: center;
        font-size: 11px;
        letter-spacing: 3px;
        font-weight: 600;
        color: #64748b;
        padding: 10px 0 6px;
        background: linear-gradient(
          to bottom,
          rgba(124, 58, 237, 0.15),
          rgba(124, 58, 237, 0)
        );
        border-top: 2px solid rgba(124, 58, 237, 0.5);
        border-radius: 60% 60% 0 0 / 18px 18px 0 0;
        box-shadow: 0 6px 10px -8px rgba(124, 58, 237, 0.55);
      }
      .grid-wrap {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .grid-row {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .row-label {
        width: 18px;
        text-align: center;
        font-size: 11px;
        font-weight: 600;
        color: #94a3b8;
        font-variant-numeric: tabular-nums;
      }
      .aisle {
        display: inline-block;
        width: 16px;
      }
      .seat {
        all: unset;
        box-sizing: border-box;
        width: 34px;
        height: 34px;
        border-radius: 8px 8px 4px 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font: 600 11px/1 "Inter", system-ui, sans-serif;
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

      @media (max-width: 640px) {
        .seat {
          width: 26px;
          height: 26px;
          font-size: 10px;
          border-radius: 6px 6px 3px 3px;
        }
        .aisle {
          width: 10px;
        }
        .grid-row {
          gap: 4px;
        }
        .row-label {
          width: 14px;
          font-size: 10px;
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

  /** 5 rows of 13 seats each = 65. Rendered in a classic auditorium layout. */
  readonly rows = ROW_LABELS.map((label, r) => ({
    label,
    cells: Array.from<unknown, Cell>({ length: COLS }, (_, c) => ({
      id: r * COLS + c + 1,
      row: label,
      col: c + 1,
    })),
  }));

  readonly unavailableSet = computed(() => new Set(this.unavailable()));

  /** Aisles after col 4 and col 9 to create three sections like a theater. */
  shouldInsertAisle(col: number): boolean {
    return col === 4 || col === 9;
  }

  tooltipFor(cell: Cell): string {
    if (this.unavailableSet().has(cell.id)) {
      return `Seat ${cell.id} (${cell.row}${cell.col}) · Booked`;
    }
    return `Seat ${cell.id} (${cell.row}${cell.col})`;
  }

  pick(id: number): void {
    if (this.unavailableSet().has(id) || this.disabled()) return;
    this.selectedChange.emit(id);
  }
}
