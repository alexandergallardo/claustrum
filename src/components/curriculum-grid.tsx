"use client";

import { useNavigate, useSearch } from "@tanstack/react-router";
import { Lock, Unlock, Link } from "lucide-react";
import React, { useState, useCallback, useRef, useEffect } from "react";
import { flushSync } from "react-dom";

import type { StudyPlanDetail } from "@/lib/types";

import { useStudentCourseStatuses } from "@/lib/hooks/use-queries";
import { useCurriculumViewModel } from "@/lib/hooks/useCurriculumViewModel";

import { CourseCard, type RelationType } from "./course-card";

interface CurriculumGridProps {
  planDetail: StudyPlanDetail;
  userId?: string;
  studyPlanId?: number;
  zoom?: number;
}

function CurriculumGrid({ planDetail, userId, studyPlanId, zoom = 1 }: CurriculumGridProps) {
  const [hoveredCourse, setHoveredCourse] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [contentWidth, setContentWidth] = useState<number | null>(null);
  const scaledContentRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate({ from: "/curriculum/" });
  const search = useSearch({ from: "/curriculum/" });

  const { data: statusMap } = useStudentCourseStatuses(userId ?? null, studyPlanId ?? null);
  const { semesters, courseById } = useCurriculumViewModel(planDetail, statusMap);

  useEffect(() => {
    const el = scaledContentRef.current;
    if (!el) return;

    const updateSize = () => {
      setContentHeight(el.scrollHeight);
      setContentWidth(el.scrollWidth);
    };

    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [zoom, semesters]);

  const getRelationType = useCallback(
    (targetId: string, courseId: string): RelationType => {
      const target = courseById.get(targetId);
      const course = courseById.get(courseId);
      if (!target || !course) return null;

      if (target.prerequisites?.includes(courseId)) return "prerequisite";
      if (target.corequisites?.includes(courseId)) return "corequisite";
      if (course.prerequisites?.includes(targetId)) return "postrequisite";

      return null;
    },
    [courseById],
  );

  const handleCourseClick = useCallback(
    (courseId: string) => {
      flushSync(() => {
        setSelectedCourseId(courseId);
      });

      void navigate({
        to: "/curriculum/$courseId",
        params: { courseId },
        search,
        viewTransition: {
          types: ["course-open"],
        },
      });
    },
    [navigate, search],
  );

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="relative z-0 min-h-0 flex-1 overflow-x-auto overflow-y-auto">
        <div
          className="origin-top-left px-4"
          style={{
            transform: `scale(${zoom})`,
            width:
              contentHeight && contentWidth ? `${(contentWidth + 32) * zoom}px` : `${100 / zoom}%`,
            height: contentHeight ? `${contentHeight * zoom}px` : undefined,
          }}
        >
          <div ref={scaledContentRef} className="flex gap-4 py-4">
            {semesters.map((semester) => (
              <div key={semester.levelNumber} className="w-48 flex-shrink-0">
                <div className="border-border mb-4 border-b pb-2">
                  <h2 className="text-foreground text-lg font-semibold">{semester.levelLabel}</h2>
                </div>
                <div className="space-y-4">
                  {semester.courses.map((course) => (
                    <button
                      type="button"
                      key={course.id}
                      className="block w-full text-left"
                      onMouseEnter={() => setHoveredCourse(course.id)}
                      onMouseLeave={() => setHoveredCourse(null)}
                      onClick={() => handleCourseClick(course.id)}
                    >
                      <CourseCard
                        id={`course-${course.id}`}
                        course={course}
                        transitionName={
                          selectedCourseId === course.id ? `course-name-${course.id}` : undefined
                        }
                        isHovered={hoveredCourse === course.id}
                        relationType={
                          hoveredCourse ? getRelationType(hoveredCourse, course.id) : null
                        }
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-border shrink-0 border-t px-4 pt-1 pb-2">
        <div className="flex flex-row gap-8">
          <div>
            <h3 className="text-foreground mb-3 text-sm font-semibold">Leyenda de estados</h3>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded border-2 border-emerald-500/30 bg-emerald-500/20" />
                <span className="text-muted-foreground text-sm">Aprobado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded border-2 border-blue-500/30 bg-blue-500/20" />
                <span className="text-muted-foreground text-sm">En curso</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-muted border-border h-6 w-6 rounded border-2" />
                <span className="text-muted-foreground text-sm">No cursado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded border-2 border-red-500/30 bg-red-500/20" />
                <span className="text-muted-foreground text-sm">Reprobado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded border-2 border-amber-500/30 bg-amber-500/20" />
                <span className="text-muted-foreground text-sm">Retirado</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-foreground mb-3 text-sm font-semibold">Relaciones</h3>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="bg-background flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-amber-500 text-amber-600 shadow-sm">
                  <Lock className="size-3 shrink-0" />
                </div>
                <span className="text-muted-foreground text-sm">Requisito</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-background flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-blue-500 text-blue-600 shadow-sm">
                  <Link className="size-3 shrink-0" />
                </div>
                <span className="text-muted-foreground text-sm">Correquisito</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-background flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500 text-emerald-600 shadow-sm">
                  <Unlock className="size-3 shrink-0" />
                </div>
                <span className="text-muted-foreground text-sm">Desbloquea</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const MemoizedCurriculumGrid = React.memo(CurriculumGrid);
