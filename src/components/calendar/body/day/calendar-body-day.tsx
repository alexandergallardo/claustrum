import CalendarBodyDayContent from './calendar-body-day-content'
import { useCalendarContext } from '../../calendar-context'
import CalendarBodyDayMargin from './calendar-body-day-margin'
import { START_HOUR, END_HOUR } from './calendar-body-day-margin'

const HEADER_HEIGHT = 33

export default function CalendarBodyDay() {
  const { date, hourHeight } = useCalendarContext()
  const totalHours = END_HOUR - START_HOUR + 1
  const contentHeight = totalHours * hourHeight + HEADER_HEIGHT

  return (
    <div className="flex divide-x flex-1 min-w-0">
      <div className="flex flex-col divide-y flex-1 min-w-0">
        <div className="flex flex-col flex-1 min-w-0">
          <div
            className="relative flex divide-x flex-1 min-w-0"
            style={{ minHeight: contentHeight }}
          >
            <CalendarBodyDayMargin />
            <CalendarBodyDayContent date={date} />
          </div>
        </div>
      </div>
    </div>
  )
}
