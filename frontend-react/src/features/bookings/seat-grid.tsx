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
              'flex h-10 w-10 items-center justify-center rounded-md border text-xs font-medium transition-colors',
              isDisabled && 'cursor-not-allowed border-muted bg-muted text-muted-foreground/40',
              isUnavailable && !isDisabled && 'cursor-not-allowed border-red-200 bg-red-50 text-red-400',
              canSelect && !isSelected && 'cursor-pointer border-border bg-card hover:border-primary hover:bg-primary/5',
              isSelected && 'border-primary bg-primary text-primary-foreground',
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
  )
}
