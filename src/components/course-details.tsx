"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
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
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  AcademicTerm,
  Course,
  CourseAttempt,
  CourseLatestTermGroup,
  CourseRecentProfessor,
  CourseStatus,
} from "@/lib/types";

import { CourseRelationFlow } from "@/components/course-relation-flow";
import { EvaluationUploadDialog } from "@/components/evaluations/evaluation-upload-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatEvaluationFileName, type EvaluationType } from "@/lib/evaluations/types";
import { useCourseEvaluations } from "@/lib/hooks/use-evaluations";
import { useIsAdmin } from "@/lib/hooks/use-professor-reviews";
import {
  useCourseInferredAcademicTerms,
  useCourseAttempts,
  useCourseEquivalents,
  useCourseLatestTermGroups,
  useCourseRecentProfessors,
  useUpdateCourseAttempt,
} from "@/lib/hooks/use-queries";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

interface CourseDetailsProps {
  course: Course;
  courseById: Map<string, Course>;
  userId?: string;
  studyPlanId?: number;
  campusId?: number;
  modalityName?: string;
  transitionName?: string;
  onCreateAttempt: (
    courseId: string,
    attempt: {
      status: Exclude<CourseStatus, "not_taken">;
      grade: number | null;
      academicTermId: number;
    },
  ) => Promise<"success" | "local">;
}

const statusLabels: Record<CourseStatus, string> = {
  approved: "Aprobado",
  failed: "Reprobado",
  not_taken: "No cursado",
  withdrawn: "Retirado",
  in_progress: "En curso",
};

const statusConfig: Record<CourseStatus, { color: string; bg: string; ring: string; dot: string }> =
  {
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
  };

const WEEKDAYS = ["", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTime(value: string) {
  return value.slice(0, 5);
}

function formatMeetingLine(meeting: {
  weekday: number;
  starts_at: string;
  ends_at: string;
  classroom: string | null;
}) {
  const weekday = WEEKDAYS[meeting.weekday] ?? `Dia ${meeting.weekday}`;
  const classroom = meeting.classroom ? ` • Aula ${meeting.classroom}` : "";
  return `${weekday} ${formatTime(meeting.starts_at)}-${formatTime(meeting.ends_at)}${classroom}`;
}

function getInitials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hues = [15, 45, 160, 200, 260, 320]; // warm, amber, teal, blue, violet, rose
  const hue = hues[Math.abs(hash) % hues.length];
  return `hsl(${hue} 70% 45%)`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: CourseStatus }) {
  const cfg = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${cfg.bg} ${cfg.color} ${cfg.ring}`}
    >
      <span className={`size-1.5 rounded-full ${cfg.dot}`} />
      {statusLabels[status]}
    </span>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

function TimelineItem({
  attempt,
  termLabel,
  onEdit,
}: {
  attempt: CourseAttempt;
  termLabel: string;
  onEdit: (attempt: CourseAttempt) => void;
}) {
  const cfg = statusConfig[attempt.status];
  const date = new Date(attempt.recordedAt);
  const gradeText = attempt.grade === null ? null : `${Math.round(attempt.grade)}`;

  return (
    <div className="relative flex gap-4">
      {/* line */}
      <div className="flex flex-col items-center">
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-full ring-2 ${cfg.bg} ${cfg.ring}`}
        >
          <span className={`text-xs font-bold ${cfg.color}`}>#{attempt.attemptNumber}</span>
        </div>
        <div className="bg-border mt-1 w-px flex-1" />
      </div>

      {/* content */}
      <div className="min-w-0 flex-1 pb-6">
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-foreground text-sm font-semibold">
              {statusLabels[attempt.status]}
            </span>
            <span className="text-muted-foreground text-xs">{date.toLocaleDateString()}</span>
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
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
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
  );
}

function ProfessorCard({
  professor,
  onPrepareTransition,
}: {
  professor: CourseRecentProfessor;
  onPrepareTransition: (key: string, id: number, name: string) => void;
}) {
  const color = stringToColor(professor.professorName);
  const transitionKey = `prof-${professor.professorId}`;

  return (
    <Link
      to="/professors/$professorId"
      params={{ professorId: String(professor.professorId) }}
      viewTransition={{ types: ["professor-open"] }}
      className="group border-border bg-card hover:bg-accent/50 flex items-center gap-3 rounded-xl border p-3 transition-colors"
      onPointerDown={() =>
        onPrepareTransition(transitionKey, professor.professorId, professor.professorName)
      }
    >
      <Avatar className="size-10 shrink-0" style={{ backgroundColor: `${color}20` }}>
        <AvatarFallback className="text-sm font-semibold" style={{ color }}>
          {getInitials(professor.professorName)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-sm font-medium group-hover:underline">
          {professor.professorName}
        </p>
        <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          <span>{professor.lastTaughtTermName}</span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" />
            {professor.groupsInLastTermCount} grupos
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-0.5">
        <span className="text-foreground text-lg leading-none font-bold">
          {professor.termsTaughtCount}
        </span>
        <span className="text-muted-foreground text-[10px] tracking-wider uppercase">periodos</span>
      </div>
    </Link>
  );
}

function ScheduleGroupCard({
  group,
  onPrepareTransition,
}: {
  group: CourseLatestTermGroup;
  onPrepareTransition: (key: string, id: number, name: string) => void;
}) {
  const professors = group.professors ?? [];
  const meetings = group.meetings ?? [];

  return (
    <div className="border-border bg-card space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs font-semibold">
            Grupo {group.groupCode}
          </Badge>
          <span className="text-muted-foreground text-xs">{group.groupType}</span>
        </div>
      </div>

      {group.campusName ? (
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <MapPin className="size-3.5" />
          {group.campusName}
        </div>
      ) : null}

      <Separator />

      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <User className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
          <div className="flex flex-wrap gap-1">
            {professors.length === 0 ? (
              <span className="text-muted-foreground text-xs">Sin asignar</span>
            ) : (
              professors.map((professor, index) => {
                const transitionKey = `group-${group.groupId}-${professor.id}`;
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
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Clock className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
          <div className="flex flex-col gap-0.5">
            {meetings.length === 0 ? (
              <span className="text-muted-foreground text-xs">Sin horario registrado</span>
            ) : (
              meetings.map((meeting, index) => (
                <span key={index} className="text-foreground text-xs">
                  {formatMeetingLine(meeting)}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Users className="size-3.5 shrink-0" />
          {group.capacity} cupos
        </div>
      </div>
    </div>
  );
}

function EvaluationDocument({
  courseCode,
  evaluation,
  onPreview,
}: {
  courseCode: string;
  evaluation: {
    id: number;
    file_key: string;
    evaluation_type: EvaluationType;
    evaluation_number: number | null;
    custom_name: string | null;
    term_display_name: string | null;
    professor_name: string | null;
    is_catedra: boolean;
    includes_answers: boolean;
    has_separate_answers: boolean;
    file_size: number;
    status: string;
  };
  onPreview: (payload: { id: number }) => void;
}) {
  const fileName = formatEvaluationFileName(
    courseCode,
    evaluation.evaluation_type,
    evaluation.evaluation_number,
    evaluation.custom_name,
  );

  return (
    <div className="group border-border bg-card hover:bg-accent/30 flex items-start gap-3 rounded-xl border p-3 transition-colors">
      <div className="bg-primary/5 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
        <FileText className="size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() =>
              onPreview({
                id: evaluation.id,
              })
            }
            className="min-w-0 cursor-pointer truncate text-left text-sm font-medium underline-offset-4 hover:underline"
          >
            {fileName}
          </button>
          <div className="text-muted-foreground shrink-0 text-right text-xs">
            {evaluation.term_display_name ? <div>{evaluation.term_display_name}</div> : null}
          </div>
        </div>

        <div className="text-muted-foreground mt-0.5 flex items-center justify-between gap-3 text-xs">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
            {evaluation.is_catedra ? <span>Cátedra</span> : null}
            {evaluation.professor_name ? (
              <span className="truncate">{evaluation.professor_name}</span>
            ) : null}
          </div>
          <span className="shrink-0 font-mono">{formatFileSize(evaluation.file_size)}</span>
        </div>
      </div>
    </div>
  );
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
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { data: isAdmin } = useIsAdmin();

  const [gradeInput, setGradeInput] = useState("");
  const [academicTermId, setAcademicTermId] = useState<string>("");
  const [isProgressSheetOpen, setIsProgressSheetOpen] = useState(false);
  const [progressStatus, setProgressStatus] =
    useState<Exclude<CourseStatus, "not_taken">>("approved");
  const [isSaving, setIsSaving] = useState(false);
  const [equivalentsPage, setEquivalentsPage] = useState(0);
  const [isExamUploadOpen, setIsExamUploadOpen] = useState(false);
  const [editingAttempt, setEditingAttempt] = useState<CourseAttempt | null>(null);
  const [editAcademicTermId, setEditAcademicTermId] = useState<string>("");
  const [editGradeInput, setEditGradeInput] = useState("");
  const comboboxPortalContainerRef = useRef<HTMLDivElement | null>(null);
  const progressTermTriggerRef = useRef<HTMLButtonElement | null>(null);
  const editTermTriggerRef = useRef<HTMLButtonElement | null>(null);
  const navigate = useNavigate();
  const updateCourseAttempt = useUpdateCourseAttempt();

  const EQUIVALENTS_PER_PAGE = 10;

  useEffect(() => {
    setGradeInput("");
    setProgressStatus("approved");
    setIsProgressSheetOpen(false);
    setEquivalentsPage(0);
  }, [course.id]);

  const inferredTermsQuery = useCourseInferredAcademicTerms(
    parseInt(course.id),
    campusId ?? null,
    null,
  );
  const academicTerms = useMemo(() => inferredTermsQuery.data ?? [], [inferredTermsQuery.data]);

  useEffect(() => {
    if (!academicTermId && academicTerms.length > 0) {
      setAcademicTermId(String(academicTerms[0].id));
    }
  }, [academicTermId, academicTerms]);

  const queryResult = useCourseEquivalents(
    studyPlanId ?? null,
    parseInt(course.id),
    equivalentsPage,
    EQUIVALENTS_PER_PAGE,
  );

  const attemptsQuery = useCourseAttempts(userId ?? null, studyPlanId ?? null, parseInt(course.id));

  const recentProfessorsQuery = useCourseRecentProfessors(parseInt(course.id), null, null);
  const latestGroupsQuery = useCourseLatestTermGroups(parseInt(course.id), null, null);
  const evaluationsQuery = useCourseEvaluations(parseInt(course.id));

  const equivalentsResult = queryResult.data;
  const totalEquivalents = queryResult.data?.totalCount ?? 0;
  const equivalents = equivalentsResult?.data ?? [];
  const totalPages = Math.ceil(totalEquivalents / EQUIVALENTS_PER_PAGE);

  const recentProfessors = recentProfessorsQuery.data ?? [];
  const latestTermGroups = latestGroupsQuery.data ?? [];
  const latestTermName = latestTermGroups[0]?.termDisplayName ?? null;
  const evaluations = evaluationsQuery.data ?? [];

  const prerequisites = (course.prerequisites || [])
    .map((id) => courseById.get(id))
    .filter((item): item is Course => item !== undefined);

  const corequisites = (course.corequisites || [])
    .map((id) => courseById.get(id))
    .filter((item): item is Course => item !== undefined);

  const isPrerequisiteFor = Array.from(courseById.values()).filter((item) =>
    item.prerequisites?.includes(course.id),
  );

  const attempts: CourseAttempt[] = attemptsQuery.data ?? [];
  const termLabelById = new Map<number, string>(
    academicTerms.map((term: AcademicTerm) => [term.id, term.display_name]),
  );
  const selectedQuickTerm =
    academicTerms.find((term) => String(term.id) === academicTermId) ?? null;
  const selectedEditTerm =
    academicTerms.find((term) => String(term.id) === editAcademicTermId) ?? null;

  /* --- handlers (preserved) --- */

  const parseSelectedTermId = () => {
    const parsed = Number(academicTermId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      toast.error("Debes seleccionar el periodo en que llevaste el curso");
      return null;
    }
    return parsed;
  };

  const handleSaveProgress = async () => {
    const parsedAcademicTermId = parseSelectedTermId();
    if (!parsedAcademicTermId) return;

    const requiresGrade = progressStatus === "approved" || progressStatus === "failed";
    const parsedGrade = gradeInput.trim() === "" ? null : Number(gradeInput);

    if (requiresGrade) {
      if (parsedGrade === null || Number.isNaN(parsedGrade)) {
        toast.error("Debes ingresar una nota");
        return;
      }
      if (parsedGrade < 0 || parsedGrade > 100) {
        toast.error("La nota debe estar entre 0 y 100");
        return;
      }
    }

    setIsSaving(true);
    try {
      const result = await onCreateAttempt(course.id, {
        status: progressStatus,
        grade: requiresGrade ? parsedGrade : null,
        academicTermId: parsedAcademicTermId,
      });

      if (result === "local") {
        toast.success("Progreso guardado localmente", {
          description: "Inicia sesión para guardar el historial de intentos permanentemente",
          duration: 5000,
        });
      } else {
        toast.success("Progreso registrado correctamente");
      }

      setGradeInput("");
      setProgressStatus("approved");
      setIsProgressSheetOpen(false);
      void attemptsQuery.refetch();
    } catch {
      toast.error("Error al registrar el progreso");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGradeInputChange = (value: string) => {
    if (value === "") {
      setGradeInput("");
      return;
    }
    if (!/^\d{0,3}(\.\d{0,2})?$/.test(value)) return;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    setGradeInput(String(Math.min(100, Math.max(0, parsed))));
  };

  const handleGradeStep = (delta: number) => {
    const current = gradeInput.trim() === "" ? 0 : Number(gradeInput);
    if (Number.isNaN(current)) {
      setGradeInput("0");
      return;
    }
    const next = Math.min(100, Math.max(0, Math.round((current + delta) * 100) / 100));
    setGradeInput(String(next));
  };

  const handleEditGradeInputChange = (value: string) => {
    if (value === "") {
      setEditGradeInput("");
      return;
    }
    if (!/^\d{0,3}(\.\d{0,2})?$/.test(value)) return;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    setEditGradeInput(String(Math.min(100, Math.max(0, parsed))));
  };

  const handleEditGradeStep = (delta: number) => {
    const current = editGradeInput.trim() === "" ? 0 : Number(editGradeInput);
    if (Number.isNaN(current)) {
      setEditGradeInput("0");
      return;
    }
    const next = Math.min(100, Math.max(0, Math.round((current + delta) * 100) / 100));
    setEditGradeInput(String(next));
  };

  const openEditAttempt = (attempt: CourseAttempt) => {
    setEditingAttempt(attempt);
    setEditAcademicTermId(attempt.academicTermId ? String(attempt.academicTermId) : "");
    setEditGradeInput(attempt.grade === null ? "" : String(attempt.grade));
  };

  const handleSaveAttemptEdit = async () => {
    if (!editingAttempt) return;
    if (!userId || !studyPlanId) {
      toast.error("Debes iniciar sesión para editar intentos");
      return;
    }

    const parsedAcademicTermId = Number(editAcademicTermId);
    if (!Number.isInteger(parsedAcademicTermId) || parsedAcademicTermId <= 0) {
      toast.error("Debes seleccionar un periodo");
      return;
    }

    const requiresGrade =
      editingAttempt.status === "approved" || editingAttempt.status === "failed";
    const parsedGrade = editGradeInput.trim() === "" ? null : Number(editGradeInput);

    if (requiresGrade) {
      if (parsedGrade === null || Number.isNaN(parsedGrade)) {
        toast.error("Debes ingresar una nota");
        return;
      }
      if (parsedGrade < 0 || parsedGrade > 100) {
        toast.error("La nota debe estar entre 0 y 100");
        return;
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
      });
      toast.success("Intento actualizado");
      setEditingAttempt(null);
      void attemptsQuery.refetch();
    } catch {
      toast.error("No se pudo actualizar el intento");
    }
  };

  const seedProfessorNameInCache = (professorId: number, professorName: string) => {
    queryClient.setQueryData(["professorById", professorId], {
      id: professorId,
      full_name: professorName,
    });
  };

  const prepareProfessorTransition = (
    _transitionKey: string,
    professorId: number,
    professorName: string,
  ) => {
    seedProfessorNameInCache(professorId, professorName);
  };

  /* --- derived state for hero --- */
  const currentStatus = course.status;
  const requiresProgressGrade = progressStatus === "approved" || progressStatus === "failed";

  const progressForm = (
    <div className="space-y-6">
      <div>
        <Label className="text-sm">Periodo</Label>
        <Combobox
          items={academicTerms}
          value={selectedQuickTerm}
          onValueChange={(term) => setAcademicTermId(term ? String(term.id) : "")}
          itemToStringValue={(term) => term.display_name}
        >
          <ComboboxTrigger
            ref={progressTermTriggerRef}
            render={
              <Button variant="outline" className="mt-2 w-full justify-between font-normal" />
            }
          >
            <span
              className={`block min-w-0 flex-1 truncate text-left ${!selectedQuickTerm ? "text-muted-foreground" : ""}`}
            >
              {selectedQuickTerm?.display_name ??
                (inferredTermsQuery.isLoading ? "Cargando..." : "Selecciona un periodo")}
            </span>
          </ComboboxTrigger>
          <ComboboxContent
            anchor={progressTermTriggerRef}
            container={comboboxPortalContainerRef}
            className="w-72"
          >
            <ComboboxInput showTrigger={false} placeholder="Buscar período..." />
            <ComboboxEmpty>No se encontraron períodos.</ComboboxEmpty>
            <ComboboxList className="max-h-56 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
        <Label className="text-sm">Estado</Label>
        <RadioGroup
          className="mt-3 grid grid-cols-2 gap-2"
          value={progressStatus}
          onValueChange={(value) => setProgressStatus(value as Exclude<CourseStatus, "not_taken">)}
        >
          {(
            [
              { value: "approved", label: "Aprobado" },
              { value: "failed", label: "Reprobado" },
              { value: "in_progress", label: "En curso" },
              { value: "withdrawn", label: "Retirado" },
            ] as const
          ).map((option) => {
            const cfg = statusConfig[option.value];
            const isSelected = progressStatus === option.value;
            return (
              <label
                key={option.value}
                htmlFor={`progress-status-${option.value}`}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors",
                  isSelected ? `${cfg.bg} ${cfg.ring} ring-1` : "border-border hover:bg-accent/50",
                )}
              >
                <RadioGroupItem id={`progress-status-${option.value}`} value={option.value} />
                <div className="flex items-center gap-1.5">
                  <span className={`size-2 rounded-full ${cfg.dot}`} />
                  <span className="text-sm font-medium">{option.label}</span>
                </div>
              </label>
            );
          })}
        </RadioGroup>
      </div>

      {requiresProgressGrade ? (
        <div>
          <Label className="text-sm">Nota</Label>
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
      ) : null}
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-10">
      {/* ========== HERO HEADER ========== */}
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
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
        <div className="border-border flex items-center gap-6 border-y py-3">
          <div className="flex items-center gap-2">
            <BookOpen className="text-muted-foreground size-4" />
            <div>
              <p className="text-lg leading-none font-bold">{course.credits}</p>
              <p className="text-muted-foreground mt-0.5 text-[10px] tracking-wider uppercase">
                Créditos
              </p>
            </div>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div className="flex items-center gap-2">
            <Clock className="text-muted-foreground size-4" />
            <div>
              <p className="text-lg leading-none font-bold">{course.hours}</p>
              <p className="text-muted-foreground mt-0.5 text-[10px] tracking-wider uppercase">
                Horas
              </p>
            </div>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div className="flex items-center gap-2">
            <GraduationCap className="text-muted-foreground size-4" />
            <div>
              <p className="text-lg leading-none font-bold">{course.semester}</p>
              <p className="text-muted-foreground mt-0.5 text-[10px] tracking-wider uppercase">
                {modalityName || "Nivel"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========== ATTEMPTS TIMELINE ========== */}
      {userId ? (
        <section>
          <SectionHeader
            title="Historial de intentos"
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsProgressSheetOpen(true)}
              >
                <Plus className="mr-1.5 size-4" />
                Registrar progreso
              </Button>
            }
          />
          {attemptsQuery.isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="bg-muted size-8 shrink-0 animate-pulse rounded-full" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="bg-muted h-4 w-32 animate-pulse rounded" />
                    <div className="bg-muted h-3 w-48 animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : attempts.length === 0 ? (
            <div className="border-border flex flex-col items-center justify-center rounded-2xl border border-dashed py-12 text-center">
              <GraduationCap className="text-muted-foreground/50 mb-3 size-8" />
              <p className="text-foreground text-sm font-medium">Aún no hay intentos registrados</p>
              <p className="text-muted-foreground mt-1 text-xs">
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

      {isMobile ? (
        <Sheet open={isProgressSheetOpen} onOpenChange={setIsProgressSheetOpen}>
          <SheetContent side="bottom" className="h-[86vh] overflow-hidden p-0">
            <div ref={comboboxPortalContainerRef} className="absolute top-0 left-0 size-0" />
            <SheetHeader>
              <SheetTitle>Registrar progreso</SheetTitle>
              <SheetDescription>
                Guarda el estado de este curso para el periodo seleccionado.
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{progressForm}</div>
            <SheetFooter className="border-t px-4 pt-3 pb-4">
              <Button
                type="button"
                onClick={handleSaveProgress}
                disabled={isSaving || !academicTermId}
                className="w-full"
              >
                {isSaving ? "Guardando..." : "Guardar progreso"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={isProgressSheetOpen} onOpenChange={setIsProgressSheetOpen}>
          <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-lg">
            <div ref={comboboxPortalContainerRef} className="absolute top-0 left-0 size-0" />
            <DialogHeader>
              <DialogTitle>Registrar progreso</DialogTitle>
              <DialogDescription>
                Guarda el estado de este curso para el periodo seleccionado.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 px-1 pb-1">{progressForm}</div>
            <DialogFooter>
              <Button
                type="button"
                onClick={handleSaveProgress}
                disabled={isSaving || !academicTermId}
              >
                {isSaving ? "Guardando..." : "Guardar progreso"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
              <div key={i} className="bg-muted h-16 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : evaluations.length === 0 ? (
          <div className="border-border flex flex-col items-center justify-center rounded-2xl border border-dashed py-12 text-center">
            <FileText className="text-muted-foreground/50 mb-3 size-8" />
            <p className="text-foreground text-sm font-medium">
              Aún no hay evaluaciones publicadas
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
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
                onPreview={({ id }) =>
                  void navigate({
                    to: "/evaluations/view/$evaluationSlug",
                    params: { evaluationSlug: `${id}.pdf` },
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
              <div key={i} className="bg-muted h-16 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : recentProfessors.length === 0 ? (
          <div className="border-border flex flex-col items-center justify-center rounded-2xl border border-dashed py-12 text-center">
            <User className="text-muted-foreground/50 mb-3 size-8" />
            <p className="text-foreground text-sm font-medium">
              No hay registros de profesores recientes
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
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
              <div key={i} className="bg-muted mb-4 h-48 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : latestTermGroups.length === 0 ? (
          <div className="border-border flex flex-col items-center justify-center rounded-2xl border border-dashed py-12 text-center">
            <Clock className="text-muted-foreground/50 mb-3 size-8" />
            <p className="text-foreground text-sm font-medium">No hay grupos registrados</p>
            <p className="text-muted-foreground mt-1 text-xs">
              No se encontraron horarios para este curso en el periodo actual
            </p>
          </div>
        ) : (
          <div className="columns-1 gap-4 md:columns-2 2xl:columns-3">
            {latestTermGroups.map((group: CourseLatestTermGroup) => (
              <div key={group.groupId} className="mb-4 break-inside-avoid">
                <ScheduleGroupCard group={group} onPrepareTransition={prepareProfessorTransition} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ========== EQUIVALENCES ========== */}
      {equivalents.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Equivalencias</h2>
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
                <span className="text-muted-foreground text-xs tabular-nums">
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {equivalents.map(
              (eq: {
                id: number;
                code: string | null;
                name: string | null;
                credits: number | null;
                weeklyHours: number | null;
              }) => (
                <div
                  key={eq.id}
                  className="border-border bg-card hover:border-primary/40 overflow-hidden rounded-lg border-2 shadow-sm transition-all duration-200"
                >
                  <div className="border-border bg-card border-b px-3 py-2">
                    <div className="text-muted-foreground flex items-center justify-between font-mono text-xs">
                      <span className="min-w-[3ch] text-right">{eq.credits ?? 0} cr</span>
                      <span className="flex-1 px-2 text-center font-semibold">
                        {eq.code || "SIN-CODIGO"}
                      </span>
                      <span className="min-w-[4ch] text-left">{eq.weeklyHours ?? 0} h</span>
                    </div>
                  </div>
                  <div className="bg-muted flex min-h-16 items-center justify-center px-3 py-2 text-center">
                    <p className="text-foreground line-clamp-2 text-xs leading-tight font-semibold">
                      {eq.name || "Sin nombre"}
                    </p>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>
      )}

      <Dialog
        open={!!editingAttempt}
        onOpenChange={(open) => {
          if (!open) setEditingAttempt(null);
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
                  render={
                    <Button
                      id="edit-attempt-term"
                      variant="outline"
                      className="mt-2 w-full justify-between font-normal"
                    />
                  }
                >
                  <span
                    className={`block min-w-0 flex-1 truncate text-left ${!selectedEditTerm ? "text-muted-foreground" : ""}`}
                  >
                    {selectedEditTerm?.display_name ??
                      (inferredTermsQuery.isLoading ? "Cargando..." : "Selecciona un periodo")}
                  </span>
                </ComboboxTrigger>
                <ComboboxContent
                  anchor={editTermTriggerRef}
                  container={comboboxPortalContainerRef}
                  className="w-72"
                >
                  <ComboboxInput showTrigger={false} placeholder="Buscar período..." />
                  <ComboboxEmpty>No se encontraron períodos.</ComboboxEmpty>
                  <ComboboxList className="max-h-56 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
  );
}
