"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
}

interface CurriculumGridProps {
  planDetail: StudyPlanDetail
}

const normalizeText = (text: string) => text.toUpperCase()

export function CurriculumGrid({ planDetail }: CurriculumGridProps) {
  const [courses, setCourses] = useState<Course[]>([])
const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [hoveredCourse, setHoveredCourse] = useState<string | null>(null)

  // Convert API data to Course format
  useEffect(() => {
    const convertedCourses: Course[] = planDetail.periods.flatMap((period: any) =>
      period.courses.map((course: StudyPlanCourse) => {
        const courseRelations = planDetail.courseRelations.get(course.courseId)
        const prerequisites = courseRelations?.prerequisites.map(String) ?? []
        const corequisites = courseRelations?.corequisites.map(String) ?? []

        return {
          id: course.courseId.toString(),
          code: course.courseCode,
          name: normalizeText(course.courseName || course.courseCode),
          credits: course.credits,
          hours: course.credits * 3, // Estimate hours from credits
          semester: course.levelNumber ?? 1,
          status: "not_taken" as CourseStatus,
          prerequisites,
          corequisites,
        }
      }),
    )
    setCourses(convertedCourses)
  }, [planDetail])

  const courseById = useMemo(() => {
    const map = new Map<string, Course>()
    for (const c of courses) map.set(c.id, c)
    return map
  }, [courses])

  const semesters = Array.from(new Set(courses.map((c) => c.semester))).sort((a, b) => a - b)

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

  const handleStatusChange = (courseId: string, newStatus: CourseStatus) => {
    // In a real app, this would update the backend
    console.log(`Course ${courseId} status changed to ${newStatus}`)
  }

  return (
    <div className="flex flex-col h-full min-w-0">
      <div className="relative px-4 py-4 z-0 flex-1 min-h-0 overflow-x-auto overflow-y-auto">
        <div className="flex gap-20 pb-8 pl-4">
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

      <div className="pt-6 border-t border-border px-4 pb-4 shrink-0">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Leyenda de estados:</h3>
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
            <h3 className="text-sm font-semibold text-foreground mb-3">Relaciones (al pasar el mouse):</h3>
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
