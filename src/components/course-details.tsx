"use client"

import type { Course, CourseStatus } from "@/components/curriculum-grid"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

interface CourseDetailsProps {
  course: Course | null
  courses: Course[]
  onClose: () => void
  onStatusChange: (courseId: string, status: CourseStatus) => void
}

const statusLabels: Record<CourseStatus, string> = {
  approved: "Aprobado",
  failed: "Reprobado",
  not_taken: "No cursado",
  withdrawn: "Retirado",
  in_progress: "En curso",
}

export function CourseDetails({ course, courses, onClose, onStatusChange }: CourseDetailsProps) {
  if (!course) return null

  const prerequisites = courses.filter((c) => course.prerequisites?.includes(c.id))
  const corequisites = courses.filter((c) => course.corequisites?.includes(c.id))

  return (
    <Sheet open={!!course} onOpenChange={onClose}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl">{course.name}</SheetTitle>
          <SheetDescription className="font-mono text-base">{course.code}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Créditos</p>
              <p className="text-2xl font-bold text-foreground">{course.credits}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Horas</p>
              <p className="text-2xl font-bold text-foreground">{course.hours}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Semestre</p>
              <p className="text-2xl font-bold text-foreground">{course.semester}</p>
            </div>
          </div>

          <div>
            <Label htmlFor="status" className="text-base">
              Estado del curso
            </Label>
            <Select value={course.status} onValueChange={(value) => onStatusChange(course.id, value as CourseStatus)}>
              <SelectTrigger id="status" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {prerequisites.length > 0 && (
            <div>
              <h3 className="text-base font-semibold mb-3 text-foreground">Requisitos</h3>
              <div className="space-y-2">
                {prerequisites.map((prereq) => (
                  <div key={prereq.id} className="p-3 rounded-md bg-muted/50 border border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm text-foreground">{prereq.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{prereq.code}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {statusLabels[prereq.status]}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {corequisites.length > 0 && (
            <div>
              <h3 className="text-base font-semibold mb-3 text-foreground">Correquisitos</h3>
              <div className="space-y-2">
                {corequisites.map((coreq) => (
                  <div key={coreq.id} className="p-3 rounded-md bg-muted/50 border border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm text-foreground">{coreq.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{coreq.code}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {statusLabels[coreq.status]}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
