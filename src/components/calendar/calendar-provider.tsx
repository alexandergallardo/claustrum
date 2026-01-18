import { CalendarContext } from './calendar-context'
import type { CalendarEvent, Mode } from './calendar-types'
import { DEFAULT_HOUR_HEIGHT, MIN_HOUR_HEIGHT, MAX_HOUR_HEIGHT } from './calendar-types'
import { useState, useCallback } from 'react'

const HOUR_HEIGHT_STORAGE_KEY = 'calendar-hour-height'

function getStoredHourHeight(): number {
  if (typeof window === 'undefined') return DEFAULT_HOUR_HEIGHT
  const stored = localStorage.getItem(HOUR_HEIGHT_STORAGE_KEY)
  if (!stored) return DEFAULT_HOUR_HEIGHT
  const parsed = parseInt(stored, 10)
  if (isNaN(parsed) || parsed < MIN_HOUR_HEIGHT || parsed > MAX_HOUR_HEIGHT) {
    return DEFAULT_HOUR_HEIGHT
  }
  return parsed
}

export default function CalendarProvider({
  events,
  setEvents,
  mode,
  setMode,
  date,
  setDate,
  calendarIconIsToday = true,
  children,
}: {
  events: CalendarEvent[]
  setEvents: (events: CalendarEvent[]) => void
  mode: Mode
  setMode: (mode: Mode) => void
  date: Date
  setDate: (date: Date) => void
  calendarIconIsToday: boolean
  children: React.ReactNode
}) {
  const [newEventDialogOpen, setNewEventDialogOpen] = useState(false)
  const [manageEventDialogOpen, setManageEventDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [hourHeight, setHourHeightState] = useState(getStoredHourHeight)

  const setHourHeight = useCallback((height: number) => {
    setHourHeightState(height)
    localStorage.setItem(HOUR_HEIGHT_STORAGE_KEY, String(height))
  }, [])

  return (
    <CalendarContext.Provider
      value={{
        events,
        setEvents,
        mode,
        setMode,
        date,
        setDate,
        calendarIconIsToday,
        newEventDialogOpen,
        setNewEventDialogOpen,
        manageEventDialogOpen,
        setManageEventDialogOpen,
        selectedEvent,
        setSelectedEvent,
        hourHeight,
        setHourHeight,
      }}
    >
      {children}
    </CalendarContext.Provider>
  )
}
