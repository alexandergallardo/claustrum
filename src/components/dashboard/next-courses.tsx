"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { NextCourse } from "@/lib/types"
import { Link } from "@tanstack/react-router"

interface NextCoursesProps {
  courses: NextCourse[]
  universityId: number | null
  campusId: number | null
  academicUnitId: number | null
  studyPlanId: number | null
}

export function NextCourses({ courses, universityId, campusId, academicUnitId, studyPlanId }: NextCoursesProps) {
  const searchParams = studyPlanId && universityId && campusId && academicUnitId
    ? { university: universityId, campus: campusId, career: academicUnitId, plan: studyPlanId }
    : null

  const CourseLink = ({ course }: { course: NextCourse }) => {
    if (searchParams) {
      return (
        <Link to="/curriculum" search={searchParams} className="block cursor-pointer">
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">
                  {course.code}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  {course.levelLabel}
                </span>
              </div>
              <p className="text-sm font-medium truncate mt-0.5">{course.name}</p>
              <p className="text-xs text-muted-foreground">{course.credits} créditos</p>
            </div>
          </div>
        </Link>
      )
    }
    return (
      <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">
              {course.code}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
              {course.levelLabel}
            </span>
          </div>
          <p className="text-sm font-medium truncate mt-0.5">{course.name}</p>
          <p className="text-xs text-muted-foreground">{course.credits} créditos</p>
        </div>
      </div>
    )
  }

  return (
    <Card className="h-full w-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-base">Próximos cursos</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-0 min-h-0">
        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay cursos disponibles para mostrar.
          </p>
        ) : (
          <ScrollArea className="h-full pr-3">
            <div className="space-y-2">
              {courses.map((course) => (
                <CourseLink key={course.id} course={course} />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
