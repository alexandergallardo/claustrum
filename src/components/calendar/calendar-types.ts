import type { CalendarEvent as CalendarEventType } from '@/lib/types'

export type { CalendarEventType as CalendarEvent }
export const calendarModes = ['day', 'week', 'month'] as const
export type Mode = (typeof calendarModes)[number]

// Altura de hora en píxeles (por defecto 128px = h-32)
export const DEFAULT_HOUR_HEIGHT = 128
export const MIN_HOUR_HEIGHT = 48
export const MAX_HOUR_HEIGHT = 192

export type CalendarProps = {
  events: CalendarEventType[]
  setEvents: (events: CalendarEventType[]) => void
  mode: Mode
  setMode: (mode: Mode) => void
  date: Date
  setDate: (date: Date) => void
  calendarIconIsToday?: boolean
}

export type CalendarContextType = CalendarProps & {
  newEventDialogOpen: boolean
  setNewEventDialogOpen: (open: boolean) => void
  manageEventDialogOpen: boolean
  setManageEventDialogOpen: (open: boolean) => void
  selectedEvent: CalendarEventType | null
  setSelectedEvent: (event: CalendarEventType | null) => void
  hourHeight: number
  setHourHeight: (height: number) => void
}
