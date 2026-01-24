import { useCalendarContext } from '../../calendar-context'
import { startOfWeek, addDays } from 'date-fns'
import CalendarBodyDayMargin from '../day/calendar-body-day-margin'
import CalendarBodyDayContent from '../day/calendar-body-day-content'
import { START_HOUR, END_HOUR } from '../day/calendar-body-day-margin'

const HEADER_HEIGHT = 33

export default function CalendarBodyWeek() {
  const { date, hourHeight } = useCalendarContext()

  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i))
  const totalHours = END_HOUR - START_HOUR + 1
  const contentHeight = totalHours * hourHeight + HEADER_HEIGHT

  return (
    <div className="flex divide-x flex-1 min-w-0">
      <div className="flex flex-col divide-y flex-1 min-w-0">
        <div className="flex flex-col flex-1 min-w-0">
          <div
            className="relative flex divide-x flex-1 min-w-0 flex-col md:flex-row"
            style={{ minHeight: contentHeight }}
          >
            <CalendarBodyDayMargin className="hidden md:block" />
            {weekDays.map((day) => (
              <div
                key={day.toISOString()}
                className="flex flex-1 min-w-0 divide-x md:divide-x-0"
              >
                <CalendarBodyDayMargin className="block md:hidden" />
                <CalendarBodyDayContent date={day} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
