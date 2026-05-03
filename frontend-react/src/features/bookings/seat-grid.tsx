import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface Seat {
  id: number
  x: number
  y: number
}

const SEAT_W = 22
const SEAT_H = 20
const GRID_WIDTH = 360
const GRID_HEIGHT = 500

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
]

interface SeatGridProps {
  totalSeats: number
  unavailableSeatIds: number[]
  disabledSeatIds: number[]
  selectedSeatId: number | null
  onSelect: (seatId: number) => void
}

export function SeatGrid({
  unavailableSeatIds,
  disabledSeatIds,
  selectedSeatId,
  onSelect,
}: SeatGridProps) {
  const unavailableSet = useMemo(() => new Set(unavailableSeatIds), [unavailableSeatIds])
  const disabledSet = useMemo(() => new Set(disabledSeatIds), [disabledSeatIds])

  const tooltipFor = (seat: Seat): string => {
    if (disabledSet.has(seat.id)) return `Seat ${seat.id} · Disabled by admin`
    if (unavailableSet.has(seat.id)) return `Seat ${seat.id} · Booked`
    return `Seat ${seat.id}`
  }

  return (
    <div className="flex flex-col items-center gap-4 overflow-x-hidden px-2 py-5">
      {/* Grid container — absolute positioned seats */}
      <div
        className="relative shrink-0 origin-top-center seat-grid-scale"
        style={{ width: GRID_WIDTH, height: GRID_HEIGHT }}
        role="listbox"
        aria-label="Seat selector"
      >
        {/* Entrance bar */}
        <div
          className="absolute text-center whitespace-nowrap overflow-hidden"
          style={{
            top: 296,
            left: 111.52,
            width: 74,
            fontSize: 10,
            letterSpacing: 1,
            fontWeight: 600,
            color: '#516f90',
            padding: '4px 6px',
            background: 'rgba(255, 122, 89, 0.08)',
            border: '1px solid rgba(255, 122, 89, 0.35)',
            borderRadius: 4,
            boxShadow: '0 1px 4px -2px rgba(255, 122, 89, 0.4)',
          }}
        >
          ENTRANCE
        </div>

        {/* Seats */}
        {SEAT_POSITIONS.map((seat) => {
          const isDisabled = disabledSet.has(seat.id)
          const isUnavailable = unavailableSet.has(seat.id)
          const isSelected = selectedSeatId === seat.id
          const canSelect = !isDisabled && !isUnavailable

          return (
            <motion.button
              key={seat.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              disabled={!canSelect}
              onClick={() => canSelect && onSelect(seat.id)}
              title={tooltipFor(seat)}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15, delay: seat.id * 0.008 }}
              whileHover={canSelect ? { y: -1 } : undefined}
              className={cn(
                'seat-btn',
                isSelected && 'seat-selected',
                isUnavailable && !isDisabled && 'seat-booked',
                isDisabled && 'seat-admin-disabled',
              )}
              style={{
                position: 'absolute',
                left: seat.x,
                top: seat.y,
                width: SEAT_W,
                height: SEAT_H,
              }}
            >
              {seat.id}
            </motion.button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded-t border border-foreground/8" style={{ background: '#e2e8f0' }} />
          Available
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded-t border-transparent" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }} />
          Selected
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded-t border border-foreground/8" style={{ background: 'repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 4px, #e2e8f0 4px, #e2e8f0 8px)' }} />
          Booked
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded-t" style={{ background: 'repeating-linear-gradient(-35deg, #fff7ed, #fff7ed 4px, #fed7aa 4px, #fed7aa 8px)', border: '1px solid rgba(234, 88, 12, 0.35)' }} />
          Disabled
        </span>
      </div>
    </div>
  )
}
