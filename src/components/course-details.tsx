"use client"

import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  MapPin,
  Minus,
  Pencil,
  Plus,
  User,
  Users,
} from "lucide-react"
import {
  useCourseInferredAcademicTerms,
  useCourseAttempts,
  useCourseEquivalents,
  useCourseLatestTermGroups,
  useCourseRecentProfessors,
  useUpdateCourseAttempt,
} from "@/lib/hooks/use-queries"
import type {
  AcademicTerm,
  Course,
  CourseAttempt,
  CourseLatestTermGroup,
  CourseRecentProfessor,
  CourseStatus,
} from "@/lib/types"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox"
import { Separator } from "@/components/ui/separator"
import { useIsAdmin } from "@/lib/hooks/use-professor-reviews"
import { EvaluationUploadDialog } from "@/components/evaluations/evaluation-upload-dialog"
import { useCourseEvaluations } from "@/lib/hooks/use-evaluations"

import { CourseRelationFlow } from "@/components/course-relation-flow"

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

interface CourseDetailsProps {
  course: Course
  courseById: Map<string, Course>
  userId?: string
  studyPlanId?: number
  campusId?: number
  modalityName?: string
  transitionName?: string
  onCreateAttempt: (
    courseId: string,
    attempt: {
      status: Exclude<CourseStatus, "not_taken">
      grade: number | null
      academicTermId: number
    },
  ) => Promise<"success" | "local">
}

const statusLabels: Record<CourseStatus, string> = {
  approved: "Aprobado",
  failed: "Reprobado",
  not_taken: "No cursado",
  withdrawn: "Retirado",
  in_progress: "En curso",
}

const statusConfig: Record<
  CourseStatus,
  { color: string; bg: string; ring: string; dot: string }
> = {
  approved: {
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    ring: "ring-emerald-200 dark:ring-emerald-800",
    dot: "bg-emerald-500",
  },
  failed: {
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/40",
    ring: "ring-red-200 dark:ring-red-800",
    dot: "bg-red-500",
  },
  not_taken: {
    color: "text-muted-foreground",
    bg: "bg-muted/60",
    ring: "ring-border",
    dot: "bg-muted-foreground",
  },
  withdrawn: {
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    ring: "ring-amber-200 dark:ring-amber-800",
    dot: "bg-amber-500",
  },
  in_progress: {
    color: "text-sky-700 dark:text-sky-400",
    bg: "bg-sky-50 dark:bg-sky-950/40",
    ring: "ring-sky-200 dark:ring-sky-800",
    dot: "bg-sky-500",
  },
}

const WEEKDAYS = ["", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"]

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTime(value: string) {
  return value.slice(0, 5)
}

function formatMeetingLine(meeting: {
  weekday: number
  starts_at: string
  ends_at: string
  classroom: string | null
}) {
  const weekday = WEEKDAYS[meeting.weekday] ?? `Dia ${meeting.weekday}`
  const classroom = meeting.classroom ? ` • Aula ${meeting.classroom}` : ""
  return `${weekday} ${formatTime(meeting.starts_at)}-${formatTime(meeting.ends_at)}${classroom}`
}

function getInitials(name: string) {
  const parts = name.split(" ").filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function stringToColor(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hues = [15, 45, 160, 200, 260, 320] // warm, amber, teal, blue, violet, rose
  const hue = hues[Math.abs(hash) % hues.length]
  return `hsl(${hue} 70% 45%)`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: CourseStatus }) {
  const cfg = statusConfig[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${cfg.bg} ${cfg.color} ${cfg.ring}`}
    >
      <span className={`size-1.5 rounded-full ${cfg.dot}`} />
      {statusLabels[status]}
    </span>
  )
}

function SectionHeader({
  title,
  action,
}: {
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  )
}

function TimelineItem({
  attempt,
  termLabel,
  onEdit,
}: {
  attempt: CourseAttempt
  termLabel: string
  onEdit: (attempt: CourseAttempt) => void
}) {
  const cfg = statusConfig[attempt.status]
  const date = new Date(attempt.recordedAt)
  const gradeText = attempt.grade === null ? null : `${Math.round(attempt.grade)}`

  return (
    <div className="relative flex gap-4">
      {/* line */}
      <div className="flex flex-col items-center">
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-full ring-2 ${cfg.bg} ${cfg.ring}`}
        >
          <span className={`text-xs font-bold ${cfg.color}`}>#{attempt.attemptNumber}</span>
        </div>
        <div className="mt-1 w-px flex-1 bg-border" />
      </div>

      {/* content */}
      <div className="pb-6 flex-1 min-w-0">
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {statusLabels[attempt.status]}
            </span>
            <span className="text-xs text-muted-foreground">
              {date.toLocaleDateString()}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => onEdit(attempt)}
            aria-label="Editar intento"
          >
            <Pencil className="size-3.5" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {gradeText ? (
            <span className="inline-flex items-center gap-1">
              <GraduationCap className="size-3.5" />
              Nota {gradeText}
            </span>
          ) : null}
          {termLabel ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {termLabel}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ProfessorCard({
  professor,
  onPrepareTransition,
}: {
  professor: CourseRecentProfessor
  onPrepareTransition: (key: string, id: number, name: string) => void
}) {
  const color = stringToColor(professor.professorName)
  const transitionKey = `prof-${professor.professorId}`

  return (
    <Link
      to="/professors/$professorId"
      params={{ professorId: String(professor.professorId) }}
      viewTransition={{ types: ["professor-open"] }}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent/50"
      onPointerDown={() =>
        onPrepareTransition(transitionKey, professor.professorId, professor.professorName)
      }
    >
      <Avatar className="size-10 shrink-0" style={{ backgroundColor: `${color}20` }}>
        <AvatarFallback
          className="text-sm font-semibold"
          style={{ color }}
        >
          {getInitials(professor.professorName)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground group-hover:underline">
          {professor.professorName}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
          <span>{professor.lastTaughtTermName}</span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" />
            {professor.groupsInLastTermCount} grupos
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-0.5">
        <span className="text-lg font-bold leading-none text-foreground">
          {professor.termsTaughtCount}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          periodos
        </span>
      </div>
    </Link>
  )
}

function ScheduleGroupCard({
  group,
  onPrepareTransition,
}: {
  group: CourseLatestTermGroup
  onPrepareTransition: (key: string, id: number, name: string) => void
}) {
  const professors = group.professors ?? []
  const meetings = group.meetings ?? []

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs font-semibold">
            Grupo {group.groupCode}
          </Badge>
          <span className="text-xs text-muted-foreground">{group.groupType}</span>
        </div>
      </div>

      {group.campusName ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5" />
          {group.campusName}
        </div>
      ) : null}

      <Separator />

      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <User className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="flex flex-wrap gap-1">
            {professors.length === 0 ? (
              <span className="text-xs text-muted-foreground">Sin asignar</span>
            ) : (
              professors.map((professor, index) => {
                const transitionKey = `group-${group.groupId}-${professor.id}`
                return (
                  <span key={transitionKey} className="text-xs">
                    {index > 0 ? ", " : ""}
                    <Link
                      to="/professors/$professorId"
                      params={{ professorId: String(professor.id) }}
                      viewTransition={{ types: ["professor-open"] }}
                      className="text-foreground underline-offset-2 hover:underline"
                      onPointerDown={() =>
                        onPrepareTransition(transitionKey, professor.id, professor.name)
                      }
                    >
                      {professor.name}
                    </Link>
                  </span>
                )
              })
            )}
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Clock className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="flex flex-col gap-0.5">
            {meetings.length === 0 ? (
              <span className="text-xs text-muted-foreground">Sin horario registrado</span>
            ) : (
              meetings.map((meeting, index) => (
                <span key={index} className="text-xs text-foreground">
                  {formatMeetingLine(meeting)}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="size-3.5 shrink-0" />
          {group.capacity} cupos
        </div>
      </div>
    </div>
  )
}

function formatEvaluationFileName(
  courseCode: string,
  evaluation_type: import("@/lib/evaluations/types").EvaluationType,
  evaluation_number: number | null,
  custom_name: string | null,
): string {
  const typeUpper = evaluation_type.toUpperCase()
  if (evaluation_type === "otro" && custom_name) {
    return `${courseCode}-${custom_name}.pdf`
  }
  if (evaluation_number && evaluation_number > 0) {
    return `${courseCode}-${typeUpper}-${evaluation_number}.pdf`
  }
  return `${courseCode}-${typeUpper}.pdf`
}

function EvaluationDocument({
  courseCode,
  evaluation,
  onPreview,
}: {
  courseCode: string
  evaluation: {
    id: number
    file_key: string
    evaluation_type: import("@/lib/evaluations/types").EvaluationType
    evaluation_number: number | null
    custom_name: string | null
    term_display_name: string | null
    professor_name: string | null
    is_catedra: boolean
    includes_answers: boolean
    has_separate_answers: boolean
    file_size: number
    status: string
  }
  onPreview: (key: string) => void
}) {
  const fileName = formatEvaluationFileName(
    courseCode,
    evaluation.evaluation_type,
    evaluation.evaluation_number,
    evaluation.custom_name,
  )

  return (
    <div className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent/30">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary">
        <FileText className="size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onPreview(evaluation.file_key)}
            className="min-w-0 truncate text-left text-sm font-medium hover:underline underline-offset-4 cursor-pointer"
          >
            {fileName}
          </button>
          <div className="shrink-0 text-right text-xs text-muted-foreground">
            {evaluation.term_display_name ? (
              <div>{evaluation.term_display_name}</div>
            ) : null}
            <div className="font-mono">{formatFileSize(evaluation.file_size)}</div>
          </div>
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {evaluation.is_catedra ? <span>Cátedra</span> : null}
          {evaluation.professor_name ? <span>{evaluation.professor_name}</span> : null}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

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
  const { data: isAdmin } = useIsAdmin()

  const [noteStatus, setNoteStatus] = useState<"approved" | "failed">("approved")
  const [gradeInput, setGradeInput] = useState("")
  const [academicTermId, setAcademicTermId] = useState<string>("")
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [equivalentsPage, setEquivalentsPage] = useState(0)
  const [isExamUploadOpen, setIsExamUploadOpen] = useState(false)
  const [editingAttempt, setEditingAttempt] = useState<CourseAttempt | null>(null)
  const [editAcademicTermId, setEditAcademicTermId] = useState<string>("")
  const [editGradeInput, setEditGradeInput] = useState("")
  const comboboxPortalContainerRef = useRef<HTMLDivElement | null>(null)
  const quickTermTriggerRef = useRef<HTMLButtonElement | null>(null)
  const registerTermTriggerRef = useRef<HTMLButtonElement | null>(null)
  const editTermTriggerRef = useRef<HTMLButtonElement | null>(null)
  const navigate = useNavigate()
  const updateCourseAttempt = useUpdateCourseAttempt()

  const EQUIVALENTS_PER_PAGE = 10

  useEffect(() => {
    setNoteStatus("approved")
    setGradeInput("")
    setIsRegisterDialogOpen(false)
    setEquivalentsPage(0)
  }, [course.id])

  const inferredTermsQuery = useCourseInferredAcademicTerms(parseInt(course.id), campusId ?? null, null)
  const academicTerms = inferredTermsQuery.data ?? []

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

  const recentProfessorsQuery = useCourseRecentProfessors(parseInt(course.id), null, null)
  const latestGroupsQuery = useCourseLatestTermGroups(parseInt(course.id), null, null)
  const evaluationsQuery = useCourseEvaluations(parseInt(course.id))

  const equivalentsResult = queryResult.data
  const totalEquivalents = queryResult.data?.totalCount ?? 0
  const equivalents = equivalentsResult?.data ?? []
  const totalPages = Math.ceil(totalEquivalents / EQUIVALENTS_PER_PAGE)

  const recentProfessors = recentProfessorsQuery.data ?? []
  const latestTermGroups = latestGroupsQuery.data ?? []
  const latestTermName = latestTermGroups[0]?.termDisplayName ?? null
  const evaluations = evaluationsQuery.data ?? []

  const prerequisites = (course.prerequisites || [])
    .map((id) => courseById.get(id))
    .filter((item): item is Course => item !== undefined)

  const corequisites = (course.corequisites || [])
    .map((id) => courseById.get(id))
    .filter((item): item is Course => item !== undefined)

  const isPrerequisiteFor = Array.from(courseById.values()).filter((item) =>
    item.prerequisites?.includes(course.id),
  )

  const attempts: CourseAttempt[] = attemptsQuery.data ?? []
  const termLabelById = new Map<number, string>(
    academicTerms.map((term: AcademicTerm) => [term.id, term.display_name]),
  )
  const selectedQuickTerm = academicTerms.find((term) => String(term.id) === academicTermId) ?? null
  const selectedRegisterTerm = selectedQuickTerm
  const selectedEditTerm = academicTerms.find((term) => String(term.id) === editAcademicTermId) ?? null

  /* --- handlers (preserved) --- */

  const parseSelectedTermId = () => {
    const parsed = Number(academicTermId)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      toast.error("Debes seleccionar el periodo en que llevaste el curso")
      return null
    }
    return parsed
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
    if (!/^\d{0,3}(\.\d{0,2})?$/.test(value)) return
    const parsed = Number(value)
    if (Number.isNaN(parsed)) return
    setGradeInput(String(Math.min(100, Math.max(0, parsed))))
  }

  const handleGradeStep = (delta: number) => {
    const current = gradeInput.trim() === "" ? 0 : Number(gradeInput)
    if (Number.isNaN(current)) {
      setGradeInput("0")
      return
    }
    const next = Math.min(100, Math.max(0, Math.round((current + delta) * 100) / 100))
    setGradeInput(String(next))
  }

  const handleEditGradeInputChange = (value: string) => {
    if (value === "") {
      setEditGradeInput("")
      return
    }
    if (!/^\d{0,3}(\.\d{0,2})?$/.test(value)) return
    const parsed = Number(value)
    if (Number.isNaN(parsed)) return
    setEditGradeInput(String(Math.min(100, Math.max(0, parsed))))
  }

  const handleEditGradeStep = (delta: number) => {
    const current = editGradeInput.trim() === "" ? 0 : Number(editGradeInput)
    if (Number.isNaN(current)) {
      setEditGradeInput("0")
      return
    }
    const next = Math.min(100, Math.max(0, Math.round((current + delta) * 100) / 100))
    setEditGradeInput(String(next))
  }

  const openEditAttempt = (attempt: CourseAttempt) => {
    setEditingAttempt(attempt)
    setEditAcademicTermId(attempt.academicTermId ? String(attempt.academicTermId) : "")
    setEditGradeInput(attempt.grade === null ? "" : String(attempt.grade))
  }

  const handleSaveAttemptEdit = async () => {
    if (!editingAttempt) return
    if (!userId || !studyPlanId) {
      toast.error("Debes iniciar sesión para editar intentos")
      return
    }

    const parsedAcademicTermId = Number(editAcademicTermId)
    if (!Number.isInteger(parsedAcademicTermId) || parsedAcademicTermId <= 0) {
      toast.error("Debes seleccionar un periodo")
      return
    }

    const requiresGrade = editingAttempt.status === "approved" || editingAttempt.status === "failed"
    const parsedGrade = editGradeInput.trim() === "" ? null : Number(editGradeInput)

    if (requiresGrade) {
      if (parsedGrade === null || Number.isNaN(parsedGrade)) {
        toast.error("Debes ingresar una nota")
        return
      }
      if (parsedGrade < 0 || parsedGrade > 100) {
        toast.error("La nota debe estar entre 0 y 100")
        return
      }
    }

    try {
      await updateCourseAttempt.mutateAsync({
        userId,
        studyPlanId,
        courseId: Number(course.id),
        attemptId: editingAttempt.id,
        academicTermId: parsedAcademicTermId,
        grade: requiresGrade ? parsedGrade : null,
      })
      toast.success("Intento actualizado")
      setEditingAttempt(null)
      attemptsQuery.refetch()
    } catch {
      toast.error("No se pudo actualizar el intento")
    }
  }

  const seedProfessorNameInCache = (professorId: number, professorName: string) => {
    queryClient.setQueryData(["professorById", professorId], {
      id: professorId,
      full_name: professorName,
    })
  }

  const prepareProfessorTransition = (
    _transitionKey: string,
    professorId: number,
    professorName: string,
  ) => {
    seedProfessorNameInCache(professorId, professorName)
  }

  /* --- derived state for hero --- */
  const currentStatus = course.status

  return (
    <div className="flex min-w-0 flex-col gap-10">
      {/* ========== HERO HEADER ========== */}
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h1
              className="text-3xl font-bold tracking-tight"
              style={transitionName ? { viewTransitionName: transitionName } : undefined}
            >
              {course.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {course.code}
              </Badge>
              <StatusBadge status={currentStatus} />
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-6 border-y border-border py-3">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-muted-foreground" />
            <div>
              <p className="text-lg font-bold leading-none">{course.credits}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                Créditos
              </p>
            </div>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <div>
              <p className="text-lg font-bold leading-none">{course.hours}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                Horas
              </p>
            </div>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div className="flex items-center gap-2">
            <GraduationCap className="size-4 text-muted-foreground" />
            <div>
              <p className="text-lg font-bold leading-none">{course.semester}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                {modalityName || "Nivel"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========== ACTIONS BAR ========== */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 md:flex-row md:items-end md:justify-between">
        <div className="w-full md:w-72">
          <Label htmlFor="quick-status-term" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Periodo
          </Label>
          <Combobox
            items={academicTerms}
            value={selectedQuickTerm}
            onValueChange={(term) => setAcademicTermId(term ? String(term.id) : "")}
            itemToStringValue={(term) => term.display_name}
          >
            <ComboboxTrigger
              ref={quickTermTriggerRef}
              render={<Button id="quick-status-term" variant="outline" className="mt-1.5 w-full justify-between font-normal" />}
            >
              <span className={`block min-w-0 flex-1 truncate text-left ${!selectedQuickTerm ? "text-muted-foreground" : ""}`}>
                {selectedQuickTerm?.display_name ?? (inferredTermsQuery.isLoading ? "Cargando..." : "Selecciona un periodo")}
              </span>
            </ComboboxTrigger>
            <ComboboxContent anchor={quickTermTriggerRef} className="w-72">
              <ComboboxInput showTrigger={false} placeholder="Buscar período..." />
              <ComboboxEmpty>No se encontraron períodos.</ComboboxEmpty>
              <ComboboxList className="max-h-56 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {(term) => (
                  <ComboboxItem key={term.id} value={term}>
                    <span className="block min-w-0 flex-1 truncate">{term.display_name}</span>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleQuickStatus("in_progress")}
            disabled={isSaving || !academicTermId}
          >
            Marcar en curso
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleQuickStatus("withdrawn")}
            disabled={isSaving || !academicTermId}
          >
            Marcar retirado
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setIsRegisterDialogOpen(true)}
            disabled={isSaving || !academicTermId}
          >
            Registrar nota
          </Button>
        </div>
      </div>

      {!userId ? (
        <p className="text-xs text-muted-foreground -mt-6">
          Sin iniciar sesión, solo se guarda el estado local y no el historial de intentos.
        </p>
      ) : null}

      {/* ========== ATTEMPTS TIMELINE ========== */}
      {userId ? (
        <section>
          <SectionHeader title="Historial de intentos" />
          {attemptsQuery.isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="size-8 shrink-0 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-48 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : attempts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12 text-center">
              <GraduationCap className="size-8 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-foreground">Aún no hay intentos registrados</p>
              <p className="text-xs text-muted-foreground mt-1">
                Registra tu primera nota usando el botón de arriba
              </p>
            </div>
          ) : (
            <div className="pl-1">
              {attempts.map((attempt: CourseAttempt) => (
                <TimelineItem
                  key={attempt.id}
                  attempt={attempt}
                  onEdit={openEditAttempt}
                  termLabel={
                    attempt.academicTermId
                      ? (termLabelById.get(attempt.academicTermId) ?? `#${attempt.academicTermId}`)
                      : "Sin periodo"
                  }
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* ========== COURSE RELATIONS ========== */}
      {(prerequisites.length > 0 || corequisites.length > 0 || isPrerequisiteFor.length > 0) && (
        <section>
          <SectionHeader title="Relaciones del curso" />
          <CourseRelationFlow
            course={course}
            prerequisites={prerequisites}
            corequisites={corequisites}
            dependents={isPrerequisiteFor}
          />
        </section>
      )}

      {/* ========== EVALUATIONS ========== */}
      <section>
        <SectionHeader
          title="Evaluaciones"
          action={
            <>
              {isAdmin ? (
                <Button asChild variant="outline" size="sm">
                  <Link to="/evaluations/moderation">Moderar</Link>
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => setIsExamUploadOpen(true)}>
                Subir evaluación
              </Button>
            </>
          }
        />

        {evaluationsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : evaluations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12 text-center">
            <FileText className="size-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-foreground">
              Aún no hay evaluaciones publicadas
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Sé el primero en subir material de estudio
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setIsExamUploadOpen(true)}
            >
              Subir evaluación
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {evaluations.map((evaluation) => (
              <EvaluationDocument
                key={evaluation.id}
                courseCode={course.code}
                evaluation={evaluation}
                onPreview={(key) =>
                  void navigate({
                    to: "/evaluations/view",
                    search: { key },
                  })
                }
              />
            ))}
          </div>
        )}

        <EvaluationUploadDialog
          courseId={parseInt(course.id)}
          academicTerms={academicTerms}
          recentProfessors={recentProfessors}
          open={isExamUploadOpen}
          onOpenChange={setIsExamUploadOpen}
        />
      </section>

      {/* ========== PROFESSORS ========== */}
      <section>
        <SectionHeader title="Profesores recientes" />
        {recentProfessorsQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : recentProfessors.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12 text-center">
            <User className="size-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-foreground">
              No hay registros de profesores recientes
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              No se encontraron profesores para este curso en los últimos 2 años
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {recentProfessors.map((professor: CourseRecentProfessor) => (
              <ProfessorCard
                key={professor.professorId}
                professor={professor}
                onPrepareTransition={prepareProfessorTransition}
              />
            ))}
          </div>
        )}
      </section>

      {/* ========== SCHEDULES ========== */}
      <section>
        <SectionHeader
          title="Horarios disponibles"
          action={
            latestTermName ? (
              <Badge variant="outline" className="text-xs">
                {latestTermName}
              </Badge>
            ) : null
          }
        />
        {latestGroupsQuery.isLoading ? (
          <div className="columns-1 gap-4 md:columns-2 2xl:columns-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="mb-4 h-48 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : latestTermGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12 text-center">
            <Clock className="size-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-foreground">No hay grupos registrados</p>
            <p className="text-xs text-muted-foreground mt-1">
              No se encontraron horarios para este curso en el periodo actual
            </p>
          </div>
        ) : (
          <div className="columns-1 gap-4 md:columns-2 2xl:columns-3">
            {latestTermGroups.map((group: CourseLatestTermGroup) => (
              <div key={group.groupId} className="mb-4 break-inside-avoid">
                <ScheduleGroupCard
                  group={group}
                  onPrepareTransition={prepareProfessorTransition}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ========== EQUIVALENCES ========== */}
      {equivalents.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold tracking-tight">
              Equivalencias {totalEquivalents > 0 ? `(${totalEquivalents})` : ""}
            </h2>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setEquivalentsPage(Math.max(0, equivalentsPage - 1))}
                  disabled={equivalentsPage === 0}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {equivalentsPage + 1} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setEquivalentsPage(Math.min(totalPages - 1, equivalentsPage + 1))}
                  disabled={equivalentsPage >= totalPages - 1}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {equivalents.map((eq: { id: number; code: string | null; name: string | null }) => (
              <Badge
                key={eq.id}
                variant="secondary"
                className="px-3 py-1.5 text-xs font-normal"
              >
                {eq.name || eq.code || "Sin nombre"}
                {eq.code && eq.name ? (
                  <span className="ml-1.5 font-mono text-muted-foreground">{eq.code}</span>
                ) : null}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* ========== REGISTER DIALOG (preserved) ========== */}
      <Dialog open={isRegisterDialogOpen} onOpenChange={setIsRegisterDialogOpen}>
        <DialogContent>
          <div ref={comboboxPortalContainerRef} className="absolute top-0 left-0 size-0" />
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
                <label
                  htmlFor="note-status-approved"
                  className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer"
                >
                  <RadioGroupItem id="note-status-approved" value="approved" />
                  <span className="text-sm">Aprobado</span>
                </label>
                <label
                  htmlFor="note-status-failed"
                  className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer"
                >
                  <RadioGroupItem id="note-status-failed" value="failed" />
                  <span className="text-sm">Reprobado</span>
                </label>
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="dialog-attempt-term" className="text-sm">
                Periodo
              </Label>
              <Combobox
                items={academicTerms}
                value={selectedRegisterTerm}
                onValueChange={(term) => setAcademicTermId(term ? String(term.id) : "")}
                itemToStringValue={(term) => term.display_name}
              >
                <ComboboxTrigger
                  ref={registerTermTriggerRef}
                  render={<Button id="dialog-attempt-term" variant="outline" className="mt-2 w-full justify-between font-normal" />}
                >
                  <span className={`block min-w-0 flex-1 truncate text-left ${!selectedRegisterTerm ? "text-muted-foreground" : ""}`}>
                    {selectedRegisterTerm?.display_name ?? (inferredTermsQuery.isLoading ? "Cargando..." : "Selecciona un periodo")}
                  </span>
                </ComboboxTrigger>
                <ComboboxContent
                  anchor={registerTermTriggerRef}
                  container={comboboxPortalContainerRef}
                  className="w-72"
                >
                  <ComboboxInput showTrigger={false} placeholder="Buscar período..." />
                  <ComboboxEmpty>No se encontraron períodos.</ComboboxEmpty>
                  <ComboboxList className="max-h-56 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {(term) => (
                      <ComboboxItem key={term.id} value={term}>
                        <span className="block min-w-0 flex-1 truncate">{term.display_name}</span>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>

            <div>
              <Label htmlFor="attempt-grade" className="text-sm">
                Nota
              </Label>
              <div className="mt-2 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleGradeStep(-1)}
                  aria-label="Disminuir nota"
                >
                  <Minus className="size-4" />
                </Button>
                <Input
                  id="attempt-grade"
                  className="text-center"
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
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" onClick={handleRegisterNote} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingAttempt}
        onOpenChange={(open) => {
          if (!open) setEditingAttempt(null)
        }}
      >
        <DialogContent>
          <div ref={comboboxPortalContainerRef} className="absolute top-0 left-0 size-0" />
          <DialogHeader>
            <DialogTitle>Editar intento</DialogTitle>
            <DialogDescription>
              Actualiza el periodo y la nota del intento seleccionado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-attempt-term" className="text-sm">
                Periodo
              </Label>
              <Combobox
                items={academicTerms}
                value={selectedEditTerm}
                onValueChange={(term) => setEditAcademicTermId(term ? String(term.id) : "")}
                itemToStringValue={(term) => term.display_name}
              >
                <ComboboxTrigger
                  ref={editTermTriggerRef}
                  render={<Button id="edit-attempt-term" variant="outline" className="mt-2 w-full justify-between font-normal" />}
                >
                  <span className={`block min-w-0 flex-1 truncate text-left ${!selectedEditTerm ? "text-muted-foreground" : ""}`}>
                    {selectedEditTerm?.display_name ?? (inferredTermsQuery.isLoading ? "Cargando..." : "Selecciona un periodo")}
                  </span>
                </ComboboxTrigger>
                <ComboboxContent
                  anchor={editTermTriggerRef}
                  container={comboboxPortalContainerRef}
                  className="w-72"
                >
                  <ComboboxInput showTrigger={false} placeholder="Buscar período..." />
                  <ComboboxEmpty>No se encontraron períodos.</ComboboxEmpty>
                  <ComboboxList className="max-h-56 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {(term) => (
                      <ComboboxItem key={term.id} value={term}>
                        <span className="block min-w-0 flex-1 truncate">{term.display_name}</span>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>

            <div>
              <Label htmlFor="edit-attempt-grade" className="text-sm">
                Nota
              </Label>
              <div className="mt-2 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleEditGradeStep(-1)}
                  aria-label="Disminuir nota"
                  disabled={updateCourseAttempt.isPending}
                >
                  <Minus className="size-4" />
                </Button>
                <Input
                  id="edit-attempt-grade"
                  className="text-center"
                  type="text"
                  inputMode="decimal"
                  value={editGradeInput}
                  onChange={(event) => handleEditGradeInputChange(event.target.value)}
                  placeholder="0-100"
                  disabled={updateCourseAttempt.isPending}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleEditGradeStep(1)}
                  aria-label="Aumentar nota"
                  disabled={updateCourseAttempt.isPending}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={handleSaveAttemptEdit}
              disabled={updateCourseAttempt.isPending}
            >
              {updateCourseAttempt.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
