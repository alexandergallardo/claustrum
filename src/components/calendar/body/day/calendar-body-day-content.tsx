import { useCalendarContext } from '../../calendar-context'
import { isSameDay } from 'date-fns'
import { hours } from './calendar-body-day-margin'
import CalendarBodyHeader from '../calendar-body-header'
import CalendarEvent from '../calendar-event'

export default function CalendarBodyDayContent({ date }: { date: Date }) {
  const { events, hourHeight } = useCalendarContext()

  const dayEvents = events.filter((event) => isSameDay(event.start, date))

  return (
    <div className="flex flex-col flex-grow">
      <CalendarBodyHeader date={date} />

      <div className="flex-1 relative">
        {hours.map((hour) => (
          <div
            key={hour}
            className="border-b border-border/50 group transition-[height] duration-200"
            style={{ height: `${hourHeight}px` }}
          />
        ))}

        {dayEvents.map((event) => (
          <CalendarEvent key={event.id} event={event} />
        ))}
      </div>
    </div>
  )
}
