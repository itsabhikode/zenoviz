import { cn } from '@/lib/utils'

interface SeatGridProps {
  totalSeats: number
  unavailableSeatIds: number[]
  disabledSeatIds: number[]
  selectedSeatId: number | null
  onSelect: (seatId: number) => void
}

export function SeatGrid({
  totalSeats,
  unavailableSeatIds,
  disabledSeatIds,
  selectedSeatId,
  onSelect,
}: SeatGridProps) {
  const seats = Array.from({ length: totalSeats }, (_, i) => i + 1)

  return (
    <div>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-13">
        {seats.map((id) => {
          const isDisabled = disabledSeatIds.includes(id)
          const isUnavailable = unavailableSeatIds.includes(id)
          const isSelected = selectedSeatId === id
          const canSelect = !isDisabled && !isUnavailable

          return (
            <button
              key={id}
              type="button"
              disabled={!canSelect}
              onClick={() => canSelect && onSelect(id)}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg text-xs font-semibold transition-all duration-150',
                isDisabled && 'cursor-not-allowed bg-muted text-muted-foreground/30',
                isUnavailable && !isDisabled && 'cursor-not-allowed bg-red-50 text-red-300 ring-1 ring-red-200',
                canSelect && !isSelected && 'cursor-pointer bg-white text-foreground shadow-sm ring-1 ring-border hover:ring-primary hover:bg-primary/5 hover:shadow-md',
                isSelected && 'cursor-pointer bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-md shadow-primary/30 ring-0',
              )}
              title={
                isDisabled ? `Seat ${id} (disabled)` : isUnavailable ? `Seat ${id} (taken)` : `Seat ${id}`
              }
            >
              {id}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-white shadow-sm ring-1 ring-border" />
          Available
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-gradient-to-br from-violet-500 to-violet-700 shadow-sm" />
          Selected
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-red-50 ring-1 ring-red-200" />
          Taken
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-muted" />
          Disabled
        </div>
      </div>
    </div>
  )
}
