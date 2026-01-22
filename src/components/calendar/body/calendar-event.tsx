import type { CalendarEvent as CalendarEventType } from '@/lib/types'
import { useCalendarContext } from '../calendar-context'
import { format, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { getColorClasses } from '@/lib/color-utils'
import { START_HOUR, END_HOUR } from './day/calendar-body-day-margin'

interface EventPosition {
  left: string
  width: string
  top: string
  height: string
}

function getOverlappingEvents(
  currentEvent: CalendarEventType,
  events: CalendarEventType[]
): CalendarEventType[] {
  return events.filter((event) => {
    if (event.id === currentEvent.id) return false
    return (
      currentEvent.start < event.end &&
      currentEvent.end > event.start &&
      isSameDay(currentEvent.start, event.start)
    )
  })
}

function calculateEventPosition(
  event: CalendarEventType,
  allEvents: CalendarEventType[],
  hourHeight: number
): EventPosition {
  const overlappingEvents = getOverlappingEvents(event, allEvents)
  const group = [event, ...overlappingEvents].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  )
  const position = group.indexOf(event)
  const width = `${100 / (overlappingEvents.length + 1)}%`
  const left = `${(position * 100) / (overlappingEvents.length + 1)}%`

  const startHour = event.start.getHours()
  const startMinutes = event.start.getMinutes()

  let endHour = event.end.getHours()
  let endMinutes = event.end.getMinutes()

  if (!isSameDay(event.start, event.end)) {
    endHour = END_HOUR
    endMinutes = 0
  }

  // Ajustar posición relativa al inicio del calendario (START_HOUR)
  const adjustedStartHour = Math.max(startHour - START_HOUR, 0)
  const adjustedEndHour = Math.min(endHour, END_HOUR) - START_HOUR

  const topPosition = adjustedStartHour * hourHeight + (startMinutes / 60) * hourHeight
  const adjustedStartMinutes = startHour < START_HOUR ? 0 : startMinutes
  const duration = adjustedEndHour * 60 + endMinutes - (adjustedStartHour * 60 + adjustedStartMinutes)
  const height = Math.max((duration / 60) * hourHeight, 24) // Mínimo 24px de altura

  return {
    left,
    width,
    top: `${topPosition}px`,
    height: `${height}px`,
  }
}

export default function CalendarEvent({
  event,
  month = false,
  className,
}: {
  event: CalendarEventType
  month?: boolean
  className?: string
}) {
  const { events, hourHeight } = useCalendarContext()
  const style = month ? {} : calculateEventPosition(event, events, hourHeight)

  const colorClasses = getColorClasses(event.color)

  return (
    <div
      className={cn(
        'px-2 py-1 rounded-md truncate cursor-pointer transition-all duration-200',
        colorClasses.bg,
        colorClasses.hover,
        colorClasses.border,
        'border',
        !month && 'absolute overflow-hidden',
        className
      )}
      style={style}
    >
      <div
        className={cn(
          'flex flex-col w-full',
          colorClasses.text,
          month && 'flex-row items-center justify-between'
        )}
      >
        <p className={cn('font-semibold truncate text-sm', month && 'text-xs')}>
          {event.title}
        </p>
        <p className={cn('text-xs opacity-80', month && 'text-xs')}>
          <span>{format(event.start, 'h:mm a', { locale: es })}</span>
          <span className={cn('mx-1', month && 'hidden')}>-</span>
          <span className={cn(month && 'hidden')}>
            {format(event.end, 'h:mm a', { locale: es })}
          </span>
        </p>
      </div>
    </div>
  )
}
