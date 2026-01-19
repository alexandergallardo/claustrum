import { useState, useEffect } from "react"
import { CurriculumGrid } from "@/components/curriculum-grid"
import type { StudyPlanDetail } from "@/lib/types"
import { useAuthUser } from "@/lib/hooks/use-queries"
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react"

interface PlanBoardProps {
  planDetail: StudyPlanDetail
}

const ZOOM_MIN = 0.7
const ZOOM_MAX = 1.0
const ZOOM_STEP = 0.05
const ZOOM_STORAGE_KEY = "plan-board-zoom"
const ZOOM_DEFAULT = 0.85

function getInitialZoom(): number {
  if (typeof window === "undefined") return ZOOM_DEFAULT
  const stored = localStorage.getItem(ZOOM_STORAGE_KEY)
  if (stored) {
    const zoom = parseFloat(stored)
    if (!isNaN(zoom) && zoom >= ZOOM_MIN && zoom <= ZOOM_MAX) {
      return zoom
    }
  }
  return ZOOM_DEFAULT
}

export function PlanBoard({ planDetail }: PlanBoardProps) {
  const { data: authUser } = useAuthUser()
  const userId = authUser?.id ?? undefined
  const studyPlanId = planDetail.plan?.id ?? undefined

  const [zoom, setZoom] = useState<number>(ZOOM_DEFAULT)

  useEffect(() => {
    setZoom(getInitialZoom())
  }, [])

  const handleZoomIn = () => {
    setZoom((prev) => {
      const newZoom = Math.min(prev + ZOOM_STEP, ZOOM_MAX)
      localStorage.setItem(ZOOM_STORAGE_KEY, newZoom.toString())
      return newZoom
    })
  }

  const handleZoomOut = () => {
    setZoom((prev) => {
      const newZoom = Math.max(prev - ZOOM_STEP, ZOOM_MIN)
      localStorage.setItem(ZOOM_STORAGE_KEY, newZoom.toString())
      return newZoom
    })
  }

  const handleReset = () => {
    setZoom(ZOOM_DEFAULT)
    localStorage.setItem(ZOOM_STORAGE_KEY, ZOOM_DEFAULT.toString())
  }

  const canZoomIn = zoom >= ZOOM_MAX
  const canZoomOut = zoom <= ZOOM_MIN

  return (
    <div className="relative h-full flex flex-col">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 rounded-lg border shadow-sm p-1">
        <button
          onClick={handleZoomOut}
          disabled={canZoomOut}
          className="p-2 hover:bg-muted rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Alejar"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="w-12 text-center text-sm font-medium tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          disabled={canZoomIn}
          className="p-2 hover:bg-muted rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Acercar"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-border mx-1" />
        <button
          onClick={handleReset}
          className="p-2 hover:bg-muted rounded-md transition-colors"
          title="Restablecer tamaño"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0">
        <CurriculumGrid planDetail={planDetail} userId={userId} studyPlanId={studyPlanId} zoom={zoom} />
      </div>
    </div>
  )
}

