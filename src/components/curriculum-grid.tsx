"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useStudentCourseStatuses, useUpdateCourseStatus } from "@/lib/hooks/use-queries"
import { CourseCard, type RelationType } from "./course-card"
import { CourseDetails } from "./course-details"
import type { StudyPlanDetail, StudyPlanCourse } from "@/lib/types"
import { Lock, Unlock, Link } from "lucide-react"

export type CourseStatus = "approved" | "failed" | "not_taken" | "withdrawn" | "in_progress"

export interface Course {
  id: string
  code: string
  name: string
  credits: number
  hours: number
  semester: number
  status: CourseStatus
  prerequisites?: string[]
  corequisites?: string[]
  equivalents?: string[]
}

interface CurriculumGridProps {
  planDetail: StudyPlanDetail
  userId?: string
  studyPlanId?: number
  zoom?: number
}

const normalizeText = (text: string) => text.toUpperCase()

export function CurriculumGrid({ planDetail, userId, studyPlanId, zoom = 1 }: CurriculumGridProps) {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [hoveredCourse, setHoveredCourse] = useState<string | null>(null)
  const [contentHeight, setContentHeight] = useState<number | null>(null)
  const [contentWidth, setContentWidth] = useState<number | null>(null)
  const scaledContentRef = useRef<HTMLDivElement>(null)

  const { data: statusMap } = useStudentCourseStatuses(userId ?? null, studyPlanId ?? null)
  const updateCourseStatus = useUpdateCourseStatus()

  useEffect(() => {
    const convertedCourses: Course[] = planDetail.periods.flatMap((period: any) =>
      period.courses.map((course: StudyPlanCourse) => {
        const courseRelations = planDetail.courseRelations.get(course.courseId)
        const prerequisites = courseRelations?.prerequisites.map(String) ?? []
        const corequisites = courseRelations?.corequisites.map(String) ?? []
        const equivalents = courseRelations?.equivalents?.map(String) ?? []
        const status = statusMap?.get(course.courseId) ?? "not_taken"

        return {
          id: course.courseId.toString(),
          code: course.courseCode,
          name: normalizeText(course.courseName || course.courseCode),
          credits: course.credits,
          hours: course.credits * 3,
          semester: course.levelNumber ?? 1,
          status,
          prerequisites,
          corequisites,
          equivalents,
        }
      }),
    )
    setCourses(convertedCourses)
    setContentHeight(null)
  }, [planDetail, statusMap])

  const courseById = useMemo(() => {
    const map = new Map<string, Course>()
    for (const c of courses) map.set(c.id, c)
    return map
  }, [courses])

  const semesters = Array.from(new Set(courses.map((c) => c.semester))).sort((a, b) => a - b)

  useEffect(() => {
    if (scaledContentRef.current) {
      const height = scaledContentRef.current.scrollHeight
      const width = scaledContentRef.current.scrollWidth
      setContentHeight(height)
      setContentWidth(width)
    }
  }, [zoom, courses])

  const getRelationType = useCallback((targetId: string, courseId: string): RelationType => {
    const target = courseById.get(targetId)
    const course = courseById.get(courseId)
    if (!target || !course) return null

    if (target.prerequisites?.includes(courseId)) return 'prerequisite'
    if (target.corequisites?.includes(courseId)) return 'corequisite'
    if (course.prerequisites?.includes(targetId)) return 'postrequisite'

    return null
  }, [courseById])

  const handleCourseClick = (course: Course) => {
    setSelectedCourse(course)
  }

  const handleStatusChange = useCallback(async (courseId: string, newStatus: CourseStatus) => {
    if (!userId || !studyPlanId) {
      throw new Error("No puedes guardar cambios sin estar autenticado y tener un plan de estudios seleccionado")
    }

    try {
      await updateCourseStatus.mutateAsync({
        userId,
        studyPlanId,
        courseId: parseInt(courseId),
        status: newStatus,
      })
    } catch (error) {
      throw error
    }
  }, [userId, studyPlanId, updateCourseStatus])

  return (
    <div className="flex flex-col h-full min-w-0">
      <div className="relative py-4 z-0 flex-1 min-h-0 overflow-x-auto overflow-y-auto">
        <div
          className="origin-top-left px-4"
          style={{
            transform: `scale(${zoom})`,
            width: contentHeight && contentWidth ? `${(contentWidth + 32) * zoom}px` : `${100 / zoom}%`,
            height: contentHeight ? `${contentHeight * zoom}px` : undefined,
          }}
        >
          <div ref={scaledContentRef} className="flex gap-20 pb-4">
            {semesters.map((semester) => (
              <div key={semester} className="flex-shrink-0 w-48">
                <div className="mb-4 pb-2 border-b border-border">
                  <h2 className="text-lg font-semibold text-foreground">
                    {`Semestre ${semester}`}
                  </h2>
                </div>
                <div className="space-y-4">
                  {courses
                    .filter((c) => c.semester === semester)
                    .map((course) => (
                      <div
                        key={course.id}
                        onMouseEnter={() => setHoveredCourse(course.id)}
                        onMouseLeave={() => setHoveredCourse(null)}
                        onClick={() => handleCourseClick(course)}
                      >
                        <CourseCard
                          id={`course-${course.id}`}
                          course={course}
                          isHovered={hoveredCourse === course.id}
                          relationType={hoveredCourse ? getRelationType(hoveredCourse, course.id) : null}
                        />
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pt-1 border-t border-border px-4 pb-2 shrink-0">
        <div className="flex flex-row gap-8">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Leyenda de estados</h3>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-chart-2/20 border-2 border-chart-2/30" />
                <span className="text-sm text-muted-foreground">Aprobado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-chart-1/20 border-2 border-chart-1/30" />
                <span className="text-sm text-muted-foreground">En curso</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-muted border-2 border-border" />
                <span className="text-sm text-muted-foreground">No cursado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-destructive/20 border-2 border-destructive/30" />
                <span className="text-sm text-muted-foreground">Reprobado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-muted/50 border-2 border-muted-foreground/20" />
                <span className="text-sm text-muted-foreground">Retirado</span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Relaciones</h3>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-background border-2 border-amber-500 text-amber-600 shadow-sm">
                  <Lock className="w-3 h-3" />
                </div>
                <span className="text-sm text-muted-foreground">Requisito (necesario)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-background border-2 border-blue-500 text-blue-600 shadow-sm">
                  <Link className="w-3 h-3" />
                </div>
                <span className="text-sm text-muted-foreground">Correquisito (simultáneo)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-background border-2 border-emerald-500 text-emerald-600 shadow-sm">
                  <Unlock className="w-3 h-3" />
                </div>
                <span className="text-sm text-muted-foreground">Desbloquea (siguiente)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CourseDetails
        course={selectedCourse}
        courses={courses}
        onClose={() => setSelectedCourse(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  )
}
