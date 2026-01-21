"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { NextCourse } from "@/lib/types"
import { BookOpen, ArrowRight } from "lucide-react"

interface NextCoursesProps {
  courses: NextCourse[]
  studyPlanId: number | null
}

export function NextCourses({ courses, studyPlanId }: NextCoursesProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Próximos Cursos</CardTitle>
        <BookOpen className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay cursos disponibles para mostrar.
          </p>
        ) : (
          <div className="space-y-3">
            {courses.slice(0, 5).map((course) => (
              <div
                key={course.id}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
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
                {studyPlanId && (
                  <a href={`/app/curriculum?plan=${studyPlanId}`}>
                    <Button variant="ghost" size="icon" className="ml-2">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </a>
                )}
              </div>
            ))}
            {courses.length > 5 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                +{courses.length - 5} cursos más disponibles
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
