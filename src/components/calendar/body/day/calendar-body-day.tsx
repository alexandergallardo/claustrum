import CalendarBodyDayContent from './calendar-body-day-content'
import { useCalendarContext } from '../../calendar-context'
import CalendarBodyDayMargin from './calendar-body-day-margin'

export default function CalendarBodyDay() {
  const { date } = useCalendarContext()
  return (
    <div className="flex divide-x flex-grow overflow-hidden">
      <div className="flex flex-col flex-grow divide-y overflow-hidden">
        <div className="flex flex-col flex-1 overflow-y-auto">
          <div className="relative flex flex-1 divide-x">
            <CalendarBodyDayMargin />
            <CalendarBodyDayContent date={date} />
          </div>
        </div>
      </div>
    </div>
  )
}
