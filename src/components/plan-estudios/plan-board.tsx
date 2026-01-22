import React, { useState, useEffect, useMemo } from "react"
import { useAuthUser } from "@/lib/hooks/use-queries"
import { MemoizedCurriculumGrid } from "@/components/curriculum-grid"
import type { StudyPlanDetail } from "@/lib/types"
import { ZoomIn, ZoomOut, RotateCcw, ChevronDown, ChevronUp, GraduationCap, Calendar, BookOpen } from "lucide-react"

interface PlanBoardProps {
  planDetail: StudyPlanDetail
}

const ZOOM_MIN = 0.7
const ZOOM_MAX = 1.0
const ZOOM_STEP = 0.05
const ZOOM_STORAGE_KEY = "plan-board-zoom"
const ZOOM_DEFAULT = 0.85
const PANEL_OPEN_STORAGE_KEY = "plan-board-panel-open"

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

function getInitialPanelOpen(): boolean {
  if (typeof window === "undefined") return true
  const stored = localStorage.getItem(PANEL_OPEN_STORAGE_KEY)
  return stored !== "false"
}

function PlanBoard({ planDetail }: PlanBoardProps) {
  const { data: authUser } = useAuthUser()
  const userId = useMemo(() => authUser?.id ?? undefined, [authUser?.id])
  const studyPlanId = useMemo(() => planDetail.plan?.id ?? undefined, [planDetail.plan?.id])

  const [zoom, setZoom] = useState<number>(ZOOM_DEFAULT)
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(getInitialPanelOpen)

  useEffect(() => {
    setZoom(getInitialZoom())
  }, [])

  useEffect(() => {
    localStorage.setItem(PANEL_OPEN_STORAGE_KEY, isPanelOpen.toString())
  }, [isPanelOpen])

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
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          className="flex items-center gap-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 rounded-lg border shadow-sm p-1.5 hover:bg-muted transition-colors"
          title={isPanelOpen ? "Ocultar controles" : "Mostrar controles"}
        >
          <span className="text-sm font-medium">{Math.round(zoom * 100)}%</span>
          {isPanelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {isPanelOpen && (
          <div className="absolute right-0 top-full mt-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 rounded-lg border shadow-lg p-3 min-w-[220px]">
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

            {planDetail.plan && (
              <>
                <div className="border-t border-border pt-2 mt-2 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <GraduationCap className="w-4 h-4" />
                    <span>{planDetail.plan.academic_degree || "Sin grado"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BookOpen className="w-4 h-4" />
                    <span>{planDetail.plan.modality_name || "Sin modalidad"}</span>
                  </div>
                  {planDetail.plan.external_plan_id && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>Plan: {planDetail.plan.external_plan_id}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <MemoizedCurriculumGrid planDetail={planDetail} userId={userId} studyPlanId={studyPlanId} zoom={zoom} />
      </div>
    </div>
  )
}

export const MemoizedPlanBoard = React.memo(PlanBoard)

