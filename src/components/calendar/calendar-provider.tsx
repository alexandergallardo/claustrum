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
  onRemoveEvent,
  hourHeight: externalHourHeight,
  setHourHeight: externalSetHourHeight,
  children,
}: {
  events: CalendarEvent[]
  setEvents: (events: CalendarEvent[]) => void
  mode: Mode
  setMode: (mode: Mode) => void
  date: Date
  setDate: (date: Date) => void
  calendarIconIsToday: boolean
  onRemoveEvent?: (event: CalendarEvent) => void
  hourHeight?: number
  setHourHeight?: (height: number) => void
  children: React.ReactNode
}) {
  const [newEventDialogOpen, setNewEventDialogOpen] = useState(false)
  const [manageEventDialogOpen, setManageEventDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [internalHourHeight, setHourHeightState] = useState(getStoredHourHeight)

  const hourHeight = externalHourHeight ?? internalHourHeight

  const setHourHeight = useCallback((height: number) => {
    if (externalSetHourHeight) {
      externalSetHourHeight(height)
    } else {
      setHourHeightState(height)
      localStorage.setItem(HOUR_HEIGHT_STORAGE_KEY, String(height))
    }
  }, [externalSetHourHeight])

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
        onRemoveEvent,
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
