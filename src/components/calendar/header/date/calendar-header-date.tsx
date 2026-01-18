import CalendarHeaderDateIcon from './calendar-header-date-icon'
import CalendarHeaderDateChevrons from './calendar-header-date-chevrons'

export default function CalendarHeaderDate() {
  return (
    <div className="flex items-center gap-3">
      <CalendarHeaderDateIcon />
      <CalendarHeaderDateChevrons />
    </div>
  )
}
