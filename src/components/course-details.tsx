"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useCourseEquivalents } from "@/lib/hooks/use-queries"
import type { Course, CourseStatus } from "@/lib/types"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface CourseDetailsProps {
  course: Course | null
  courseById: Map<string, Course>
  studyPlanId?: number
  modalityName?: string
  onClose: () => void
  onStatusChange: (courseId: string, status: CourseStatus) => Promise<"success" | "local">
}

const statusLabels: Record<CourseStatus, string> = {
  approved: "Aprobado",
  failed: "Reprobado",
  not_taken: "No cursado",
  withdrawn: "Retirado",
  in_progress: "En curso",
}

const statusBadgeStyles: Record<CourseStatus, { bg: string; border: string }> = {
  approved: { bg: "bg-chart-2/20", border: "border-chart-2/30" },
  failed: { bg: "bg-destructive/20", border: "border-destructive/30" },
  not_taken: { bg: "bg-muted", border: "border-border" },
  withdrawn: { bg: "bg-muted/50", border: "border-muted-foreground/20" },
  in_progress: { bg: "bg-chart-1/20", border: "border-chart-1/30" },
}

function StatusBadge({ status }: { status: CourseStatus }) {
  const styles = statusBadgeStyles[status]
  return (
    <Badge variant="outline" className={`text-xs ${styles.bg} ${styles.border}`}>
      {statusLabels[status]}
    </Badge>
  )
}

export function CourseDetails({ course, courseById, studyPlanId, modalityName, onClose, onStatusChange }: CourseDetailsProps) {
  const [localStatus, setLocalStatus] = useState<CourseStatus | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [equivalentsPage, setEquivalentsPage] = useState(0)
  const EQUIVALENTS_PER_PAGE = 10

  useEffect(() => {
    setLocalStatus(course?.status ?? null)
    setEquivalentsPage(0)
  }, [course?.id])

  const queryResult = useCourseEquivalents(
    studyPlanId ?? null,
    course?.id ? parseInt(course.id) : null,
    equivalentsPage,
    EQUIVALENTS_PER_PAGE
  )

  const equivalentsResult = queryResult.data
  const totalEquivalents = queryResult.data?.totalCount ?? 0
  const equivalents = equivalentsResult?.data ?? []
  const totalPages = Math.ceil(totalEquivalents / EQUIVALENTS_PER_PAGE)

  if (!course) return null

  const effectiveStatus = localStatus ?? course.status

  const prerequisites = (course.prerequisites || [])
    .map((id) => courseById.get(id))
    .filter((c): c is Course => c !== undefined)

  const corequisites = (course.corequisites || [])
    .map((id) => courseById.get(id))
    .filter((c): c is Course => c !== undefined)

  const isPrerequisiteFor = Array.from(courseById.values())
    .filter((c) => c.prerequisites?.includes(course.id))

  const hasChanges = localStatus !== null && localStatus !== course.status

  const handleSave = async () => {
    if (localStatus === null || localStatus === course.status) return

    setIsSaving(true)
    try {
      const result = await onStatusChange(course.id, localStatus)

      if (result === "local") {
        toast.success("Estado del curso guardado localmente", {
          description: "Inicia sesión para guardar tu progreso permanentemente",
          duration: 5000,
        })
      } else {
        toast.success("Estado del curso actualizado correctamente")
      }

      onClose()
    } catch (err) {
      toast.error("Error al actualizar el estado del curso")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setLocalStatus(null)
    onClose()
  }

  return (
    <Sheet open={!!course} onOpenChange={handleCancel}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl">{course.name}</SheetTitle>
          <SheetDescription className="font-mono text-base">{course.code}</SheetDescription>
        </SheetHeader>

        <div className="grid flex-1 auto-rows-min gap-6 px-4 py-4">
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
              <p className="text-sm text-muted-foreground mb-1">{modalityName || "Nivel"}</p>
              <p className="text-2xl font-bold text-foreground">{course.semester}</p>
            </div>
          </div>

          <div>
            <Label htmlFor="status" className="text-base">
              Estado del curso
            </Label>
            <Select value={effectiveStatus} onValueChange={(value) => setLocalStatus(value as CourseStatus)}>
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
                      <StatusBadge status={prereq.status} />
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
                      <StatusBadge status={coreq.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isPrerequisiteFor.length > 0 && (
            <div>
              <h3 className="text-base font-semibold mb-3 text-foreground">Es requisito de</h3>
              <div className="space-y-2">
                {isPrerequisiteFor.map((postreq) => (
                  <div key={postreq.id} className="p-3 rounded-md bg-muted/50 border border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm text-foreground">{postreq.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{postreq.code}</p>
                      </div>
                      <StatusBadge status={postreq.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {equivalents.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-foreground">
                  Equivalencias {totalEquivalents > 0 && `(${totalEquivalents})`}
                </h3>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEquivalentsPage(Math.max(0, equivalentsPage - 1))}
                      disabled={equivalentsPage === 0}
                      className="h-7 w-7"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {equivalentsPage + 1}/{totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEquivalentsPage(Math.min(totalPages - 1, equivalentsPage + 1))}
                      disabled={equivalentsPage >= totalPages - 1}
                      className="h-7 w-7"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {equivalents.map((eq: { id: number; code: string | null; name: string | null }) => {
                  const displayName = eq.name || eq.code || "Sin nombre"
                  return (
                    <div key={eq.id} className="p-3 rounded-md bg-muted/50 border border-border">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm text-foreground">{displayName}</p>
                          {eq.code && (
                            <p className="text-xs text-muted-foreground font-mono">{eq.code}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        <SheetFooter>
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving ? "Guardando..." : "Guardar cambios"}
          </Button>
          <SheetClose asChild>
            <Button variant="outline">
              Cancelar
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
