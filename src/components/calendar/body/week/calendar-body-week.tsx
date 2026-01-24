import { useCalendarContext } from '../../calendar-context'
import { startOfWeek, addDays } from 'date-fns'
import CalendarBodyDayMargin from '../day/calendar-body-day-margin'
import CalendarBodyDayContent from '../day/calendar-body-day-content'
import { START_HOUR, END_HOUR } from '../day/calendar-body-day-margin'
import type { CSSProperties } from 'react'

const HEADER_HEIGHT = 33

export default function CalendarBodyWeek() {
  const { date, hourHeight, dayWidth } = useCalendarContext()

  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i))
  const totalHours = END_HOUR - START_HOUR + 1
  const contentHeight = totalHours * hourHeight + HEADER_HEIGHT

  const weekMinWidth = dayWidth * weekDays.length + 48

  return (
    <div className="flex-1 min-w-0 overflow-x-auto">
      <div
        className="relative flex divide-x min-w-[var(--week-min-width)] lg:min-w-0"
        style={{
          minHeight: contentHeight,
          '--week-min-width': `${weekMinWidth}px`,
        } as CSSProperties}
      >
        <CalendarBodyDayMargin />
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className="flex min-w-[var(--day-width)] flex-1 lg:min-w-0"
            style={{ '--day-width': `${dayWidth}px` } as CSSProperties}
          >
            <CalendarBodyDayContent date={day} />
          </div>
        ))}
      </div>
    </div>
  )
}
