import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Calendar,
  BookOpen,
} from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";

import type { StudyPlanDetail } from "@/lib/types";
import type { CourseEffectiveStatus } from "@/lib/types";

import { MemoizedCurriculumGrid } from "@/components/curriculum-grid";
import { useAppAuth } from "@/lib/auth/app-auth-context";

interface CurriculumBoardProps {
  planDetail: StudyPlanDetail;
  userId?: string;
  studyPlanId?: number;
  readOnly?: boolean;
  zoom?: number;
  mockStatusMap?: Map<number, CourseEffectiveStatus>;
}

const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.0;
const ZOOM_STEP = 0.05;
const CURRICULUM_ZOOM_STORAGE_KEY = "curriculum-board-zoom";
const ZOOM_DEFAULT = 0.75;
const CURRICULUM_PANEL_OPEN_STORAGE_KEY = "curriculum-board-panel-open";
const LEGACY_PANEL_OPEN_STORAGE_KEY = "plan-board-panel-open";

function getInitialZoom(): number {
  if (typeof window === "undefined") return ZOOM_DEFAULT;
  const stored = localStorage.getItem(CURRICULUM_ZOOM_STORAGE_KEY);
  if (stored) {
    const zoom = parseFloat(stored);
    if (!isNaN(zoom) && zoom >= ZOOM_MIN && zoom <= ZOOM_MAX) {
      return zoom;
    }
  }
  return ZOOM_DEFAULT;
}

function CurriculumBoard({
  planDetail,
  userId: propUserId,
  studyPlanId: propStudyPlanId,
  readOnly,
  zoom: propZoom,
  mockStatusMap,
}: CurriculumBoardProps) {
  const { authUser } = useAppAuth();
  const userId = useMemo(() => propUserId ?? authUser?.id ?? undefined, [propUserId, authUser?.id]);
  const studyPlanId = useMemo(
    () => propStudyPlanId ?? planDetail.plan?.id ?? undefined,
    [propStudyPlanId, planDetail.plan?.id],
  );

  const [zoom, setZoom] = useState<number>(() => propZoom ?? getInitialZoom());
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);

  useEffect(() => {
    const stored =
      localStorage.getItem(CURRICULUM_PANEL_OPEN_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_PANEL_OPEN_STORAGE_KEY);
    if (stored === "true") {
      setIsPanelOpen(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CURRICULUM_PANEL_OPEN_STORAGE_KEY, isPanelOpen.toString());
  }, [isPanelOpen]);

  const handleZoomIn = () => {
    setZoom((prev) => {
      const newZoom = Math.min(prev + ZOOM_STEP, ZOOM_MAX);
      localStorage.setItem(CURRICULUM_ZOOM_STORAGE_KEY, newZoom.toString());
      return newZoom;
    });
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const newZoom = Math.max(prev - ZOOM_STEP, ZOOM_MIN);
      localStorage.setItem(CURRICULUM_ZOOM_STORAGE_KEY, newZoom.toString());
      return newZoom;
    });
  };

  const handleReset = () => {
    setZoom(ZOOM_DEFAULT);
    localStorage.setItem(CURRICULUM_ZOOM_STORAGE_KEY, ZOOM_DEFAULT.toString());
  };

  const canZoomIn = zoom >= ZOOM_MAX;
  const canZoomOut = zoom <= ZOOM_MIN;

  return (
    <div className="relative flex h-full flex-col">
      {!readOnly && (
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className="bg-background/95 supports-[backdrop-filter]:bg-background/60 hover:bg-muted flex items-center gap-2 rounded-lg border p-1.5 shadow-sm backdrop-blur transition-colors"
            title={isPanelOpen ? "Ocultar controles" : "Mostrar controles"}
          >
            <span className="text-sm font-medium">{Math.round(zoom * 100)}%</span>
            {isPanelOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>

          {isPanelOpen && (
            <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 absolute top-full right-0 mt-2 min-w-[220px] rounded-lg border p-3 shadow-lg backdrop-blur">
              <div className="mb-3 flex items-center gap-1">
                <button
                  onClick={handleZoomOut}
                  disabled={canZoomOut}
                  className="hover:bg-muted rounded-md p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  title="Alejar"
                >
                  <ZoomOut className="size-4" />
                </button>
                <button
                  onClick={handleZoomIn}
                  disabled={canZoomIn}
                  className="hover:bg-muted rounded-md p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  title="Acercar"
                >
                  <ZoomIn className="size-4" />
                </button>
                <div className="bg-border mx-1 h-5 w-px" />
                <button
                  onClick={handleReset}
                  className="hover:bg-muted rounded-md p-2 transition-colors"
                  title="Restablecer tamaño"
                >
                  <RotateCcw className="size-4" />
                </button>
              </div>

              {planDetail.plan && (
                <>
                  <div className="border-border mt-2 space-y-2 border-t pt-2">
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <GraduationCap className="size-4" />
                      <span>{planDetail.plan.academic_degree || "Sin grado"}</span>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <BookOpen className="size-4" />
                      <span>{planDetail.plan.modality_name || "Sin modalidad"}</span>
                    </div>
                    {planDetail.plan.external_plan_id && (
                      <div className="text-muted-foreground flex items-center gap-2 text-sm">
                        <Calendar className="size-4" />
                        <span>Plan: {planDetail.plan.external_plan_id}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <MemoizedCurriculumGrid
          planDetail={planDetail}
          userId={userId}
          studyPlanId={studyPlanId}
          zoom={zoom}
          readOnly={readOnly}
          mockStatusMap={mockStatusMap}
        />
      </div>
    </div>
  );
}

export const MemoizedCurriculumBoard = React.memo(CurriculumBoard);
