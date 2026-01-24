import { useCalendarContext } from '../calendar-context'
import { MIN_HOUR_HEIGHT, MAX_HOUR_HEIGHT } from '../calendar-types'
import CalendarBodyDay from './day/calendar-body-day'
import CalendarBodyWeek from './week/calendar-body-week'
import CalendarBodyMonth from './month/calendar-body-month'
import { useCallback, useRef, useEffect } from 'react'

const ZOOM_STEP = 16

export default function CalendarBody() {
  const { mode, hourHeight, setHourHeight } = useCalendarContext()
  const containerRef = useRef<HTMLDivElement>(null)

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!e.ctrlKey || mode === 'month') return
      
      e.preventDefault()
      
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      const newHeight = Math.max(MIN_HOUR_HEIGHT, Math.min(MAX_HOUR_HEIGHT, hourHeight + delta))
      setHourHeight(newHeight)
    },
    [hourHeight, setHourHeight, mode]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  return (
    <div ref={containerRef} className="flex-1 flex flex-col">
      {mode === 'day' && <CalendarBodyDay />}
      {mode === 'week' && <CalendarBodyWeek />}
      {mode === 'month' && <CalendarBodyMonth />}
    </div>
  )
}
