import { format } from 'date-fns'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

function NavChevron({ orientation }: { orientation?: string }) {
  return orientation === 'left' ? (
    <ChevronLeft className="h-4 w-4" />
  ) : (
    <ChevronRight className="h-4 w-4" />
  )
}

interface DatePickerProps {
  value: Date | undefined
  onChange: (date: Date | undefined) => void
  placeholder?: string
  disabled?: (date: Date) => boolean
  className?: string
}

export function DatePicker({ value, onChange, placeholder = 'Pick a date', disabled, className }: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'h-11 w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, 'PPP') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 shadow-lg" align="start">
        <div className="p-4">
          <DayPicker
            mode="single"
            selected={value}
            onSelect={onChange}
            disabled={disabled}
            showOutsideDays
            classNames={{
              months: 'flex flex-col',
              month_caption: 'flex items-center justify-center relative h-10 mb-1',
              caption_label: 'text-sm font-semibold text-foreground',
              nav: 'flex items-center',
              button_previous: cn(
                'absolute left-0 inline-flex items-center justify-center rounded-md h-8 w-8',
                'border border-border/60 bg-card text-muted-foreground shadow-sm',
                'hover:bg-accent hover:text-accent-foreground transition-colors',
              ),
              button_next: cn(
                'absolute right-0 inline-flex items-center justify-center rounded-md h-8 w-8',
                'border border-border/60 bg-card text-muted-foreground shadow-sm',
                'hover:bg-accent hover:text-accent-foreground transition-colors',
              ),
              month_grid: 'w-full border-collapse mt-1',
              weekdays: 'flex',
              weekday: 'w-10 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pb-2',
              week: 'flex w-full',
              day: cn(
                'relative h-10 w-10 p-0 text-center text-sm',
                'focus-within:relative focus-within:z-20',
                '[&:has([aria-selected])]:bg-primary/10 [&:has([aria-selected])]:rounded-md',
              ),
              day_button: cn(
                'inline-flex items-center justify-center rounded-md h-10 w-10 text-sm font-normal',
                'transition-all duration-150',
                'hover:bg-accent hover:text-accent-foreground hover:shadow-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'aria-selected:opacity-100',
              ),
              selected: cn(
                'rounded-md',
                '!bg-primary !text-primary-foreground !font-semibold',
                'shadow-md shadow-primary/25',
                'hover:!bg-primary hover:!text-primary-foreground',
              ),
              today: cn(
                'rounded-md font-semibold',
                'bg-accent text-accent-foreground',
                'ring-1 ring-primary/30',
              ),
              outside: 'text-muted-foreground/30 aria-selected:bg-primary/5 aria-selected:text-muted-foreground',
              disabled: 'text-muted-foreground/20 cursor-not-allowed',
              hidden: 'invisible',
            }}
            components={{
              Chevron: NavChevron,
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
