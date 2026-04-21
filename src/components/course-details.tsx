"use client"

import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Link } from "@tanstack/react-router"
import {
  useAcademicTerms,
  useCourseAttempts,
  useCourseEquivalents,
  useCourseLatestTermGroups,
  useCourseRecentProfessors,
} from "@/lib/hooks/use-queries"
import type {
  AcademicTerm,
  Course,
  CourseAttempt,
  CourseLatestTermGroup,
  CourseRecentProfessor,
  CourseStatus,
} from "@/lib/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { ChevronLeft, ChevronRight, Clock, MapPin, Minus, Plus, User, Users } from "lucide-react"
import { getProfessorNameTransitionName } from "@/lib/utils/view-transition"
import { ExamList } from "@/components/exams/exam-list"
import { ExamUploadDialog } from "@/components/exams/exam-upload-dialog"

interface CourseDetailsProps {
  course: Course
  courseById: Map<string, Course>
  userId?: string
  studyPlanId?: number
  campusId?: number
  modalityName?: string
  transitionName?: string
  onCreateAttempt: (courseId: string, attempt: {
    status: Exclude<CourseStatus, "not_taken">
    grade: number | null
    academicTermId: number
  }) => Promise<"success" | "local">
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

const attemptCardStyles: Record<Exclude<CourseStatus, "not_taken">, { bg: string; border: string }> = {
  approved: { bg: "bg-emerald-500/20", border: "border-emerald-500/30" },
  failed: { bg: "bg-red-500/20", border: "border-red-500/30" },
  withdrawn: { bg: "bg-amber-500/20", border: "border-amber-500/30" },
  in_progress: { bg: "bg-blue-500/20", border: "border-blue-500/30" },
}

function StatusBadge({ status }: { status: CourseStatus }) {
  const styles = statusBadgeStyles[status]

  return (
    <Badge variant="outline" className={`text-xs ${styles.bg} ${styles.border}`}>
      {statusLabels[status]}
    </Badge>
  )
}

function AttemptHistoryItem({ attempt, academicTermLabel }: { attempt: CourseAttempt; academicTermLabel: string }) {
  const date = new Date(attempt.recordedAt)
  const gradeText = attempt.grade === null ? null : `${Math.round(attempt.grade)}`
  const periodText = attempt.academicTermId ? academicTermLabel : null
  const styles = attemptCardStyles[attempt.status]

  return (
    <div className={`rounded-md border p-3 ${styles.bg} ${styles.border}`}>
      <div className="grid grid-cols-[auto_1fr] gap-x-4">
        <div className="text-sm font-semibold text-foreground">#{attempt.attemptNumber}</div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">{statusLabels[attempt.status]}</p>
            <span className="text-xs text-muted-foreground">{date.toLocaleDateString()}</span>
          </div>
          {gradeText ? <p className="text-sm text-foreground">Nota: {gradeText}</p> : null}
          {periodText ? <p className="text-sm text-foreground">Periodo: {periodText}</p> : null}
        </div>
      </div>
    </div>
  )
}

const WEEKDAYS = ["", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"]

function formatTime(value: string) {
  return value.slice(0, 5)
}

function formatMeetingLine(meeting: { weekday: number; starts_at: string; ends_at: string; classroom: string | null }) {
  const weekday = WEEKDAYS[meeting.weekday] ?? `Dia ${meeting.weekday}`
  const classroom = meeting.classroom ? ` • Aula ${meeting.classroom}` : ""
  return `${weekday} ${formatTime(meeting.starts_at)}-${formatTime(meeting.ends_at)}${classroom}`
}

export function CourseDetails({
  course,
  courseById,
  userId,
  studyPlanId,
  campusId,
  modalityName,
  transitionName,
  onCreateAttempt,
}: CourseDetailsProps) {
  const queryClient = useQueryClient()
  const [activeProfessorTransitionKey, setActiveProfessorTransitionKey] = useState<string | null>(null)
  const [noteStatus, setNoteStatus] = useState<"approved" | "failed">("approved")
  const [gradeInput, setGradeInput] = useState("")
  const [academicTermId, setAcademicTermId] = useState<string>("")
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [equivalentsPage, setEquivalentsPage] = useState(0)
  const [isExamUploadOpen, setIsExamUploadOpen] = useState(false)
  const EQUIVALENTS_PER_PAGE = 10

  useEffect(() => {
    setNoteStatus("approved")
    setGradeInput("")
    setIsRegisterDialogOpen(false)
    setEquivalentsPage(0)
  }, [course.id])

  const termsQuery = useAcademicTerms(campusId ?? null)
  const academicTerms = termsQuery.data ?? []

  useEffect(() => {
    if (!academicTermId && academicTerms.length > 0) {
      setAcademicTermId(String(academicTerms[0].id))
    }
  }, [academicTermId, academicTerms])

  const queryResult = useCourseEquivalents(
    studyPlanId ?? null,
    parseInt(course.id),
    equivalentsPage,
    EQUIVALENTS_PER_PAGE,
  )

  const attemptsQuery = useCourseAttempts(
    userId ?? null,
    studyPlanId ?? null,
    parseInt(course.id),
  )

  const recentProfessorsQuery = useCourseRecentProfessors(
    parseInt(course.id),
    null,
    null,
  )

  const latestGroupsQuery = useCourseLatestTermGroups(
    parseInt(course.id),
    null,
    null,
  )

  const equivalentsResult = queryResult.data
  const totalEquivalents = queryResult.data?.totalCount ?? 0
  const equivalents = equivalentsResult?.data ?? []
  const totalPages = Math.ceil(totalEquivalents / EQUIVALENTS_PER_PAGE)
  const recentProfessors = recentProfessorsQuery.data ?? []
  const latestTermGroups = latestGroupsQuery.data ?? []
  const latestTermName = latestTermGroups[0]?.termDisplayName ?? null

  const prerequisites = (course.prerequisites || [])
    .map((id) => courseById.get(id))
    .filter((item): item is Course => item !== undefined)

  const corequisites = (course.corequisites || [])
    .map((id) => courseById.get(id))
    .filter((item): item is Course => item !== undefined)

  const isPrerequisiteFor = Array.from(courseById.values())
    .filter((item) => item.prerequisites?.includes(course.id))

  const attempts: CourseAttempt[] = attemptsQuery.data ?? []
  const termLabelById = new Map<number, string>(
    academicTerms.map((term: AcademicTerm) => [term.id, term.display_name]),
  )

  const parseSelectedTermId = () => {
    const parsedAcademicTermId = Number(academicTermId)
    if (!Number.isInteger(parsedAcademicTermId) || parsedAcademicTermId <= 0) {
      toast.error("Debes seleccionar el periodo en que llevaste el curso")
      return null
    }
    return parsedAcademicTermId
  }

  const handleRegisterNote = async () => {
    const parsedAcademicTermId = parseSelectedTermId()
    const parsedGrade = gradeInput.trim() === "" ? null : Number(gradeInput)

    if (!parsedAcademicTermId) return

    if (parsedGrade === null || Number.isNaN(parsedGrade)) {
      toast.error("Debes ingresar una nota")
      return
    }

    if (parsedGrade < 0 || parsedGrade > 100) {
      toast.error("La nota debe estar entre 0 y 100")
      return
    }

    setIsSaving(true)
    try {
      const result = await onCreateAttempt(course.id, {
        status: noteStatus,
        grade: parsedGrade,
        academicTermId: parsedAcademicTermId,
      })

      if (result === "local") {
        toast.success("Intento guardado localmente", {
          description: "Inicia sesión para guardar el historial de intentos permanentemente",
          duration: 5000,
        })
      } else {
        toast.success("Intento registrado correctamente")
      }

      setGradeInput("")
      setNoteStatus("approved")
      setIsRegisterDialogOpen(false)
      attemptsQuery.refetch()
    } catch {
      toast.error("Error al registrar el intento")
    } finally {
      setIsSaving(false)
    }
  }

  const handleQuickStatus = async (status: "in_progress" | "withdrawn") => {
    const parsedAcademicTermId = parseSelectedTermId()
    if (!parsedAcademicTermId) return

    setIsSaving(true)
    try {
      const result = await onCreateAttempt(course.id, {
        status,
        grade: null,
        academicTermId: parsedAcademicTermId,
      })

      if (result === "local") {
        toast.success("Estado guardado localmente", {
          description: "Inicia sesión para guardar el historial de intentos permanentemente",
          duration: 5000,
        })
      } else {
        toast.success("Estado actualizado")
      }

      attemptsQuery.refetch()
    } catch {
      toast.error("Error al actualizar estado")
    } finally {
      setIsSaving(false)
    }
  }

  const handleGradeInputChange = (value: string) => {
    if (value === "") {
      setGradeInput("")
      return
    }

    if (!/^\d{0,3}(\.\d{0,2})?$/.test(value)) {
      return
    }

    const parsed = Number(value)
    if (Number.isNaN(parsed)) return

    setGradeInput(String(Math.min(100, Math.max(0, parsed))))
  }

  const handleGradeStep = (delta: number) => {
    const currentValue = gradeInput.trim() === "" ? 0 : Number(gradeInput)
    if (Number.isNaN(currentValue)) {
      setGradeInput("0")
      return
    }

    const nextValue = Math.min(100, Math.max(0, Math.round((currentValue + delta) * 100) / 100))
    setGradeInput(String(nextValue))
  }

  const seedProfessorNameInCache = (professorId: number, professorName: string) => {
    queryClient.setQueryData(["professorById", professorId], {
      id: professorId,
      full_name: professorName,
    })
  }

  const prepareProfessorTransition = (transitionKey: string, professorId: number, professorName: string) => {
    setActiveProfessorTransitionKey(transitionKey)
    seedProfessorNameInCache(professorId, professorName)
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold" style={transitionName ? { viewTransitionName: transitionName } : undefined}>
          {course.name}
        </h1>
        <p className="font-mono text-base text-muted-foreground">{course.code}</p>
      </header>

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

      <section className="rounded-md border border-border p-4 space-y-4">
        <h3 className="text-base font-semibold text-foreground">Intentos y notas</h3>

        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="w-full md:w-72">
            <Label htmlFor="quick-status-term" className="text-sm">Periodo</Label>
            <Select value={academicTermId} onValueChange={setAcademicTermId}>
              <SelectTrigger id="quick-status-term" className="mt-2 w-full">
                <SelectValue placeholder={termsQuery.isLoading ? "Cargando periodos..." : "Selecciona un periodo"} />
              </SelectTrigger>
              <SelectContent position="popper" align="start" sideOffset={4}>
                {academicTerms.map((term: AcademicTerm) => (
                  <SelectItem key={term.id} value={String(term.id)}>
                    {term.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => handleQuickStatus("in_progress")} disabled={isSaving || !academicTermId}>
              Marcar en curso
            </Button>
            <Button type="button" variant="outline" onClick={() => handleQuickStatus("withdrawn")} disabled={isSaving || !academicTermId}>
              Marcar retirado
            </Button>
            <Button type="button" onClick={() => setIsRegisterDialogOpen(true)} disabled={isSaving || !academicTermId}>
              Registrar nota
            </Button>
          </div>
        </div>

        {!userId ? (
          <p className="text-xs text-muted-foreground">
            Sin iniciar sesión, solo se guarda el estado local y no el historial de intentos.
          </p>
        ) : null}

        {userId ? (
          <div>
            <h4 className="text-sm font-semibold mb-3 text-foreground">Historial</h4>
            {attemptsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando historial...</p>
            ) : attempts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay intentos registrados.</p>
            ) : (
              <div className="space-y-2">
                {attempts.map((attempt: CourseAttempt) => (
                  <AttemptHistoryItem
                    key={attempt.id}
                    attempt={attempt}
                    academicTermLabel={
                      attempt.academicTermId ? (termLabelById.get(attempt.academicTermId) ?? `#${attempt.academicTermId}`) : "Sin periodo"
                    }
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}
      </section>

      <Dialog open={isRegisterDialogOpen} onOpenChange={setIsRegisterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar nota</DialogTitle>
            <DialogDescription>
              Guarda una nota aprobada o reprobada para este curso.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm">Estado</Label>
              <RadioGroup
                className="mt-2 grid grid-cols-2 gap-2"
                value={noteStatus}
                onValueChange={(value) => setNoteStatus(value as "approved" | "failed")}
              >
                <label htmlFor="note-status-approved" className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer">
                  <RadioGroupItem id="note-status-approved" value="approved" />
                  <span className="text-sm">Aprobado</span>
                </label>
                <label htmlFor="note-status-failed" className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer">
                  <RadioGroupItem id="note-status-failed" value="failed" />
                  <span className="text-sm">Reprobado</span>
                </label>
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="dialog-attempt-term" className="text-sm">Periodo</Label>
              <Select value={academicTermId} onValueChange={setAcademicTermId}>
                <SelectTrigger id="dialog-attempt-term" className="mt-2 w-full">
                  <SelectValue placeholder={termsQuery.isLoading ? "Cargando periodos..." : "Selecciona un periodo"} />
                </SelectTrigger>
                <SelectContent position="popper" align="start" sideOffset={4}>
                  {academicTerms.map((term: AcademicTerm) => (
                    <SelectItem key={term.id} value={String(term.id)}>
                      {term.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="attempt-grade" className="text-sm">Nota</Label>
              <div className="mt-2 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleGradeStep(-1)}
                  aria-label="Disminuir nota"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  id="attempt-grade"
                  className="text-center focus:placeholder-transparent"
                  type="text"
                  inputMode="decimal"
                  value={gradeInput}
                  onChange={(event) => handleGradeInputChange(event.target.value)}
                  placeholder="0-100"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleGradeStep(1)}
                  aria-label="Aumentar nota"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsRegisterDialogOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleRegisterNote} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {prerequisites.length > 0 ? (
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
      ) : null}

      {corequisites.length > 0 ? (
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
      ) : null}

      {isPrerequisiteFor.length > 0 ? (
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
      ) : null}

      {equivalents.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-foreground">
              Equivalencias {totalEquivalents > 0 ? `(${totalEquivalents})` : ""}
            </h3>
            {totalPages > 1 ? (
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
            ) : null}
          </div>
          <div className="space-y-2">
            {equivalents.map((eq: { id: number; code: string | null; name: string | null }) => {
              const displayName = eq.name || eq.code || "Sin nombre"

              return (
                <div key={eq.id} className="p-3 rounded-md bg-muted/50 border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-foreground">{displayName}</p>
                      {eq.code ? (
                        <p className="text-xs text-muted-foreground font-mono">{eq.code}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <section>
        <h3 className="text-base font-semibold mb-3 text-foreground">Profesores que han impartido el curso (últimos 2 años)</h3>
        {recentProfessorsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando profesores...</p>
        ) : recentProfessorsQuery.isError ? (
          <p className="text-sm text-muted-foreground">No se pudieron cargar los profesores de este curso.</p>
        ) : recentProfessors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay registros de profesores para este curso en los últimos 2 años.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profesor</TableHead>
                  <TableHead>Último período</TableHead>
                  <TableHead>Grupos (últ. período)</TableHead>
                  <TableHead>Períodos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentProfessors.map((professor: CourseRecentProfessor) => (
                  <TableRow key={professor.professorId}>
                    <TableCell>
                      {(() => {
                        const transitionKey = `table-${professor.professorId}`
                        return (
                      <Link
                        to="/professors/$professorId"
                        params={{ professorId: String(professor.professorId) }}
                        viewTransition={{ types: ["professor-open"] }}
                        className="font-medium underline-offset-4 hover:underline"
                        style={activeProfessorTransitionKey === transitionKey
                          ? { viewTransitionName: getProfessorNameTransitionName(professor.professorId) }
                          : undefined}
                        onPointerDown={() => prepareProfessorTransition(transitionKey, professor.professorId, professor.professorName)}
                        onMouseEnter={() => seedProfessorNameInCache(professor.professorId, professor.professorName)}
                        onFocus={() => prepareProfessorTransition(transitionKey, professor.professorId, professor.professorName)}
                      >
                        {professor.professorName}
                      </Link>
                        )
                      })()}
                    </TableCell>
                    <TableCell>{professor.lastTaughtTermName}</TableCell>
                    <TableCell>{professor.groupsInLastTermCount ?? 0}</TableCell>
                    <TableCell>{professor.termsTaughtCount ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">Exámenes y evaluaciones</h3>
          <Button variant="outline" size="sm" onClick={() => setIsExamUploadOpen(true)}>
            Subir examen
          </Button>
        </div>
        <ExamList courseId={parseInt(course.id)} />
        <ExamUploadDialog
          courseId={parseInt(course.id)}
          open={isExamUploadOpen}
          onOpenChange={setIsExamUploadOpen}
        />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">Horarios disponibles</h3>
          {latestTermName ? (
            <p className="text-sm text-muted-foreground">Periodo: {latestTermName}</p>
          ) : null}
        </div>
        {latestGroupsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando grupos...</p>
        ) : latestGroupsQuery.isError ? (
          <p className="text-sm text-muted-foreground">No se pudieron cargar los grupos de este curso.</p>
        ) : latestTermGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay grupos registrados para este curso.</p>
        ) : (
          <div className="space-y-2">
            <div className="columns-1 gap-3 md:columns-2 2xl:columns-3">
              {latestTermGroups.map((group: CourseLatestTermGroup) => {
                const professors = group.professors ?? []
                return (
                  <div key={group.groupId} className="mb-3 break-inside-avoid">
                    <div
                      className="flex flex-col w-full p-3 rounded-lg border-2 relative border-border bg-card"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs">Grupo {group.groupCode}</Badge>
                        <span className="text-xs text-foreground">{group.groupType}</span>
                      </div>

                      {group.campusName ? (
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs text-foreground">{group.campusName}</span>
                        </div>
                      ) : null}

                      <Separator className="mb-2" />

                      <div className="space-y-1.5">
                        <div className="flex items-start gap-2">
                          <User className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                          <span className="text-xs text-foreground">
                            {professors.length === 0 ? "Sin asignar" : professors.map((professor, index) => (
                              <span key={`${group.groupId}-prof-${professor.id}`}>
                                {index > 0 ? ", " : ""}
                                {(() => {
                                  const transitionKey = `group-${group.groupId}-${professor.id}`
                                  return (
                                <Link
                                  to="/professors/$professorId"
                                  params={{ professorId: String(professor.id) }}
                                  viewTransition={{ types: ["professor-open"] }}
                                  className="underline-offset-4 hover:underline"
                                  style={activeProfessorTransitionKey === transitionKey
                                    ? { viewTransitionName: getProfessorNameTransitionName(professor.id) }
                                    : undefined}
                                  onPointerDown={() => prepareProfessorTransition(transitionKey, professor.id, professor.name)}
                                  onMouseEnter={() => seedProfessorNameInCache(professor.id, professor.name)}
                                  onFocus={() => prepareProfessorTransition(transitionKey, professor.id, professor.name)}
                                >
                                  {professor.name}
                                </Link>
                                  )
                                })()}
                              </span>
                            ))}
                          </span>
                        </div>

                        <div className="flex items-start gap-2">
                          <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                          <div className="flex flex-col gap-1">
                            {(group.meetings ?? []).length === 0 ? (
                              <span className="text-xs text-foreground">Sin horario registrado.</span>
                            ) : (
                              (group.meetings ?? []).map((meeting, index) => (
                                <span key={`${group.groupId}-${index}`} className="text-xs text-foreground">{formatMeetingLine(meeting)}</span>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <Users className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                          <span className="text-xs text-foreground">{group.capacity} cupos</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
