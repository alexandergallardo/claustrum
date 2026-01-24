import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { useCalendarContext } from '../../calendar-context'

// Rango de horas: 7 AM a 10 PM (22:00)
export const START_HOUR = 7
export const END_HOUR = 22
export const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR)

export default function CalendarBodyDayMargin({
  className,
}: {
  className?: string
}) {
  const { hourHeight } = useCalendarContext()

  return (
    <div
      className={cn(
        'sticky left-0 w-12 bg-background z-10 flex flex-col',
        className
      )}
    >
      <div className="sticky top-0 left-0 h-[33px] bg-background z-20 border-b" />
      <div className="sticky left-0 w-12 bg-background z-10 flex flex-col">
        {hours.map((hour, index) => (
          <div
            key={hour}
            className="relative first:mt-0 transition-[height] duration-200"
            style={{ height: `${hourHeight}px` }}
          >
            <span
              className={cn(
                'absolute text-xs text-muted-foreground left-2',
                index === 0 ? 'top-1' : '-top-2.5'
              )}
            >
              {format(new Date().setHours(hour, 0, 0, 0), 'h a', { locale: es })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
