import React from 'react'
import { ZoomIn, ZoomOut, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { DEFAULT_HOUR_HEIGHT, MIN_HOUR_HEIGHT, MAX_HOUR_HEIGHT } from '@/components/calendar/calendar-types'
import { cn } from '@/lib/utils'

interface ScheduleZoomControlsProps {
  hourHeight: number
  setHourHeight: (height: number) => void
  className?: string
  isFloating?: boolean
}

const ZOOM_STEP = 16
const ZOOM_STORAGE_KEY = 'schedule-hour-height'
const DEFAULT_ZOOM_RATIO = 0.5
export const SCHEDULE_DEFAULT_HOUR_HEIGHT = Math.round(
  DEFAULT_HOUR_HEIGHT * DEFAULT_ZOOM_RATIO
)

export function ScheduleZoomControls({
  hourHeight,
  setHourHeight,
  className,
  isFloating = true,
}: ScheduleZoomControlsProps) {
  const [isPanelOpen, setIsPanelOpen] = React.useState(false)

  const handleZoomIn = () => {
    const newHeight = Math.min(hourHeight + ZOOM_STEP, MAX_HOUR_HEIGHT)
    setHourHeight(newHeight)
    localStorage.setItem(ZOOM_STORAGE_KEY, newHeight.toString())
  }

  const handleZoomOut = () => {
    const newHeight = Math.max(hourHeight - ZOOM_STEP, MIN_HOUR_HEIGHT)
    setHourHeight(newHeight)
    localStorage.setItem(ZOOM_STORAGE_KEY, newHeight.toString())
  }

  const handleReset = () => {
    setHourHeight(SCHEDULE_DEFAULT_HOUR_HEIGHT)
    localStorage.setItem(ZOOM_STORAGE_KEY, SCHEDULE_DEFAULT_HOUR_HEIGHT.toString())
  }

  const canZoomIn = hourHeight >= MAX_HOUR_HEIGHT
  const canZoomOut = hourHeight <= MIN_HOUR_HEIGHT
  const zoomPercentage = Math.round((hourHeight / DEFAULT_HOUR_HEIGHT) * 100)

  return (
    <div
      className={cn(
        isFloating ? 'absolute top-4 right-4 z-50' : 'relative',
        className
      )}
    >
      <button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className="flex items-center gap-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 rounded-lg border shadow-sm p-1.5 hover:bg-muted transition-colors"
        title={isPanelOpen ? 'Ocultar controles' : 'Mostrar controles'}
      >
        <span className="text-sm font-medium">{zoomPercentage}%</span>
        {isPanelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {isPanelOpen && (
        <div className="absolute right-0 top-full mt-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 rounded-lg border shadow-lg p-3 min-w-[220px] z-50">
          <div className="flex items-center gap-1 mb-3">
            <button
              onClick={handleZoomOut}
              disabled={canZoomOut}
              className="p-2 hover:bg-muted rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Alejar"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomIn}
              disabled={canZoomIn}
              className="p-2 hover:bg-muted rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Acercar"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-border mx-1" />
            <button
              onClick={handleReset}
              className="p-2 hover:bg-muted rounded-md transition-colors"
              title="Restablecer tamaño"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="border-t border-border pt-2 mt-2 space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Altura de hora:</span>
              <span className="font-medium text-foreground">{hourHeight}px</span>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Zoom:</span>
              <span className="font-medium text-foreground">{zoomPercentage}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
