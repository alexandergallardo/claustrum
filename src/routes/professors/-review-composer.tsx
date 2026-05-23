import { Link } from "@tanstack/react-router";
import { Minus, Plus } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  useProfessorOfferingTerms,
  useProfessorReviewCourses,
} from "@/lib/hooks/use-professor-reviews";
import { REVIEW_TAG_OPTIONS, type ReviewTag } from "@/lib/professor-reviews/types";
import { cn } from "@/lib/utils";

const Turnstile = lazy(() =>
  import("@marsidev/react-turnstile").then((module) => ({ default: module.Turnstile })),
);

type ReviewComposerProps = {
  isMobile: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitMutationPending: boolean;
  turnstileSiteKey: string | null;
  professorId: string | null;
  courseCode: string;
  setCourseCode: (value: string) => void;
  academicTermId: string;
  setAcademicTermId: (value: string) => void;
  gradeReceived: string;
  setGradeReceived: (value: string) => void;
  comment: string;
  setComment: (value: string) => void;
  easeScore: string;
  setEaseScore: (value: string) => void;
  qualityScore: string;
  setQualityScore: (value: string) => void;
  clarityScore: string;
  setClarityScore: (value: string) => void;
  fairnessScore: string;
  setFairnessScore: (value: string) => void;
  engagementLevel: string;
  setEngagementLevel: (value: string) => void;
  attendanceRequired: boolean;
  setAttendanceRequired: (value: boolean) => void;
  tags: ReviewTag[];
  turnstileToken: string | null;
  setTurnstileToken: (value: string | null) => void;
  onSubmit: () => void;
  onCloseReset: () => void;
  handleTagToggle: (tag: ReviewTag, checked: boolean) => void;
};

export function ReviewComposer({
  isMobile,
  open,
  onOpenChange,
  submitMutationPending,
  turnstileSiteKey,
  professorId,
  courseCode,
  setCourseCode,
  academicTermId,
  setAcademicTermId,
  gradeReceived,
  setGradeReceived,
  comment,
  setComment,
  easeScore,
  setEaseScore,
  qualityScore,
  setQualityScore,
  clarityScore,
  setClarityScore,
  fairnessScore,
  setFairnessScore,
  engagementLevel,
  setEngagementLevel,
  attendanceRequired,
  setAttendanceRequired,
  tags,
  turnstileToken,
  setTurnstileToken,
  onSubmit,
  onCloseReset,
  handleTagToggle,
}: ReviewComposerProps) {
  const [showReviewExample, setShowReviewExample] = useState(false);
  const comboboxPortalContainerRef = useRef<HTMLDivElement | null>(null);
  const termTriggerRef = useRef<HTMLButtonElement | null>(null);
  const courseTriggerRef = useRef<HTMLButtonElement | null>(null);
  const parsedEngagementLevel = Number(engagementLevel);
  const clampedEngagementLevel = Number.isFinite(parsedEngagementLevel)
    ? Math.min(5, Math.max(1, Math.round(parsedEngagementLevel)))
    : 4;
  const coursesQuery = useProfessorReviewCourses(professorId);
  const termsQuery = useProfessorOfferingTerms(professorId);

  const courseOptions = useMemo(() => coursesQuery.data ?? [], [coursesQuery.data]);
  const termOptions = useMemo(() => termsQuery.data ?? [], [termsQuery.data]);

  const selectedCourse =
    courseOptions.find((course) => course.code.toUpperCase() === courseCode.toUpperCase()) ?? null;
  const selectedTerm = termOptions.find((term) => String(term.id) === academicTermId) ?? null;

  useEffect(() => {
    if (academicTermId && !termOptions.some((term) => String(term.id) === academicTermId)) {
      setAcademicTermId("");
    }
  }, [academicTermId, setAcademicTermId, termOptions]);

  useEffect(() => {
    if (
      courseCode &&
      !courseOptions.some((course) => course.code.toUpperCase() === courseCode.toUpperCase())
    ) {
      setCourseCode("");
    }
  }, [courseCode, courseOptions, setCourseCode]);

  const form = (
    <div className={`space-y-4 ${isMobile ? "px-4 pb-4" : "px-1 pb-2"}`}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Curso</Label>
          <Combobox
            items={courseOptions}
            value={selectedCourse}
            onValueChange={(course) => setCourseCode(course?.code ?? "")}
            itemToStringValue={(course) => `${course.code}: ${course.name}`}
          >
            <ComboboxTrigger
              ref={courseTriggerRef}
              render={
                <Button
                  variant="outline"
                  className="w-full min-w-0 justify-between overflow-hidden font-normal"
                  disabled={coursesQuery.isLoading || courseOptions.length === 0}
                />
              }
            >
              <span
                className={cn(
                  "block min-w-0 flex-1 truncate text-left",
                  !selectedCourse && "text-muted-foreground",
                )}
              >
                {selectedCourse
                  ? `${selectedCourse.code}: ${selectedCourse.name}`
                  : coursesQuery.isLoading
                    ? "Cargando cursos..."
                    : "Seleccionar curso"}
              </span>
            </ComboboxTrigger>
            <ComboboxContent
              anchor={courseTriggerRef}
              container={comboboxPortalContainerRef}
              className="w-80"
            >
              <ComboboxInput showTrigger={false} placeholder="Buscar curso..." />
              <ComboboxEmpty>No se encontraron cursos para este profesor.</ComboboxEmpty>
              <ComboboxList className="max-h-56 scrollbar-none">
                {(course) => (
                  <ComboboxItem key={course.id} value={course}>
                    <span className="block min-w-0 flex-1 truncate">
                      {course.code}: {course.name}
                    </span>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>

        <div className="space-y-2">
          <Label>Periodo (opcional)</Label>
          <Combobox
            items={termOptions}
            value={selectedTerm}
            onValueChange={(term) => setAcademicTermId(term ? String(term.id) : "")}
            itemToStringValue={(term) => term.display_name}
          >
            <ComboboxTrigger
              ref={termTriggerRef}
              render={
                <Button
                  variant="outline"
                  className="w-full min-w-0 justify-between overflow-hidden font-normal"
                  disabled={termsQuery.isLoading || termOptions.length === 0}
                />
              }
            >
              <span
                className={cn(
                  "block min-w-0 flex-1 truncate text-left",
                  !selectedTerm && "text-muted-foreground",
                )}
              >
                {selectedTerm?.display_name ??
                  (termsQuery.isLoading ? "Cargando periodos..." : "Sin periodo")}
              </span>
            </ComboboxTrigger>
            <ComboboxContent
              anchor={termTriggerRef}
              container={comboboxPortalContainerRef}
              className="w-72"
            >
              <ComboboxInput showTrigger={false} placeholder="Buscar periodo..." />
              <ComboboxEmpty>No se encontraron periodos.</ComboboxEmpty>
              <ComboboxList className="max-h-56 scrollbar-none">
                {(term) => (
                  <ComboboxItem key={term.id} value={term}>
                    <span className="block min-w-0 flex-1 truncate">{term.display_name}</span>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="composer-grade-received">Calificación obtenida (opcional)</Label>
          <Input
            id="composer-grade-received"
            placeholder="85, A, Aprobado"
            value={gradeReceived}
            onChange={(event) => setGradeReceived(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="composer-comment">Comentario</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowReviewExample((value) => !value)}
          >
            {showReviewExample ? "Ocultar ejemplo" : "Ver ejemplo"}
          </Button>
        </div>
        {showReviewExample ? (
          <div className="grid gap-2">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
              <p className="font-medium text-emerald-700 dark:text-emerald-400">
                Ejemplo de buena reseña
              </p>
              <p className="mt-1 text-emerald-900 dark:text-emerald-100">
                "Usa clase invertida, así que conviene llegar con la lectura hecha y en clase se
                enfoca en resolver problemas aplicados; además, la retroalimentación fue clara y
                rápida, por lo que pude corregir errores a tiempo y entender mejor cómo estudiar
                para los exámenes."
              </p>
            </div>
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm">
              <p className="font-medium text-red-700 dark:text-red-400">Ejemplo de mala reseña</p>
              <p className="mt-1 text-red-900 dark:text-red-100">
                "Ese profe es un inútil, da asco y no le crean nada de lo que dice."
              </p>
            </div>
          </div>
        ) : null}
        <Textarea
          id="composer-comment"
          maxLength={1000}
          placeholder="Describe método de enseñanza, evaluación y recomendaciones prácticas para futuros estudiantes"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
        <p className="text-muted-foreground text-xs">{comment.length}/1000</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ScoreInput label="Facilidad" value={easeScore} onChange={setEaseScore} />
        <ScoreInput label="Calidad" value={qualityScore} onChange={setQualityScore} />
        <ScoreInput label="Claridad" value={clarityScore} onChange={setClarityScore} />
        <ScoreInput label="Justicia" value={fairnessScore} onChange={setFairnessScore} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="composer-engagement-level">Interés en la clase</Label>
            <span
              className={`text-sm font-medium ${clampedEngagementLevel >= 4 ? "text-green-600" : clampedEngagementLevel <= 2 ? "text-red-600" : "text-amber-600"}`}
            >
              {clampedEngagementLevel <= 2
                ? "Bajo"
                : clampedEngagementLevel >= 4
                  ? "Alto"
                  : "Medio"}
            </span>
          </div>
          <div className="flex h-9 items-center">
            <Slider
              className="w-full -translate-y-px [&_[data-slot=slider-range]]:bg-transparent [&_[data-slot=slider-track]]:bg-gradient-to-r [&_[data-slot=slider-track]]:from-red-500 [&_[data-slot=slider-track]]:to-green-500"
              id="composer-engagement-level"
              min={1}
              max={5}
              step={1}
              value={[clampedEngagementLevel]}
              onValueChange={(value) => setEngagementLevel(String(value[0] ?? 4))}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label className="block">Asistencia obligatoria</Label>
          <div className="flex h-9 items-center">
            <RadioGroup
              value={attendanceRequired ? "yes" : "no"}
              onValueChange={(value) => setAttendanceRequired(value === "yes")}
              className="flex items-center gap-4"
            >
              <label
                htmlFor="composer-attendance-yes"
                className="inline-flex items-center gap-2 text-sm"
              >
                <RadioGroupItem value="yes" id="composer-attendance-yes" />
                Sí
              </label>
              <label
                htmlFor="composer-attendance-no"
                className="inline-flex items-center gap-2 text-sm"
              >
                <RadioGroupItem value="no" id="composer-attendance-no" />
                No
              </label>
            </RadioGroup>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Etiquetas</Label>
        <div className="grid gap-2 md:grid-cols-2">
          {REVIEW_TAG_OPTIONS.map((tag) => {
            const checked = tags.includes(tag);
            return (
              <label key={tag} className="inline-flex items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => handleTagToggle(tag, Boolean(value))}
                />
                {tag}
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Verificación humana</Label>
        <div className="min-h-[70px]">
          {turnstileSiteKey ? (
            <div className="inline-flex min-h-[70px] w-[300px] max-w-full items-center overflow-hidden rounded-md">
              <Suspense
                fallback={
                  <span className="text-muted-foreground text-sm">Cargando verificación…</span>
                }
              >
                <Turnstile
                  siteKey={turnstileSiteKey}
                  options={{ language: "es", size: "normal" }}
                  onSuccess={(token) => setTurnstileToken(token)}
                  onError={() => setTurnstileToken(null)}
                  onExpire={() => setTurnstileToken(null)}
                />
              </Suspense>
            </div>
          ) : (
            <p className="text-sm text-amber-600">
              Turnstile no está configurado. Define VITE_TURNSTILE_SITE_KEY para habilitar envío.
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={onSubmit}
          disabled={submitMutationPending || !turnstileSiteKey || !turnstileToken}
        >
          {submitMutationPending ? "Enviando..." : "Enviar reseña"}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          onOpenChange(nextOpen);
          if (!nextOpen) onCloseReset();
        }}
      >
        <SheetContent side="bottom" className="h-[90vh] overflow-hidden p-0">
          <div ref={comboboxPortalContainerRef} className="absolute top-0 left-0 size-0" />
          <SheetHeader>
            <SheetTitle>Enviar reseña</SheetTitle>
            <SheetDescription className="space-y-2">
              <span className="block">
                Tu reseña es anónima y requiere aprobación antes de publicarse.
              </span>
              <Button asChild className="h-auto p-0" variant="link">
                <Link
                  to="/policies"
                  hash="politica-de-resenas-y-opiniones-sobre-docentes"
                  preload="intent"
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver reglamento de reseñas
                </Link>
              </Button>
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1">{form}</ScrollArea>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) onCloseReset();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
        <div ref={comboboxPortalContainerRef} className="absolute top-0 left-0 size-0" />
        <DialogHeader>
          <DialogTitle>Enviar reseña</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              Tu reseña es anónima y requiere aprobación antes de publicarse.
            </span>
            <Button asChild className="h-auto p-0" variant="link">
              <Link
                to="/policies"
                hash="politica-de-resenas-y-opiniones-sobre-docentes"
                preload="intent"
                target="_blank"
                rel="noreferrer"
              >
                Ver reglamento de reseñas
              </Link>
            </Button>
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0">{form}</ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function ScoreInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
}) {
  const handleValueChange = (nextValue: string) => {
    if (nextValue === "") {
      onChange("");
      return;
    }

    if (!/^\d{0,2}(\.\d?)?$/.test(nextValue)) {
      return;
    }

    const parsed = Number(nextValue);
    if (Number.isNaN(parsed)) return;

    onChange(String(Math.min(10, Math.max(0, parsed))));
  };

  const handleStep = (delta: number) => {
    const currentValue = value.trim() === "" ? 0 : Number(value);
    if (Number.isNaN(currentValue)) {
      onChange("0");
      return;
    }

    const nextValue = Math.min(10, Math.max(0, Math.round((currentValue + delta) * 10) / 10));
    onChange(String(nextValue));
  };

  const parsedValue = Number(value);
  const currentValue = Number.isNaN(parsedValue) ? 0 : Math.min(10, Math.max(0, parsedValue));
  const isAtMin = currentValue <= 0;
  const isAtMax = currentValue >= 10;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="border-input focus-within:border-ring focus-within:ring-ring/50 flex h-9 w-full items-center overflow-hidden rounded-md border bg-transparent transition-[color,box-shadow] focus-within:ring-[3px]">
        <Input
          className="h-full w-full rounded-none border-0 bg-transparent px-2 text-center tabular-nums shadow-none focus-visible:ring-0"
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => handleValueChange(event.target.value)}
          placeholder="0-10"
        />
        <Button
          type="button"
          variant="ghost"
          className="border-input text-muted-foreground hover:text-foreground h-full w-8 cursor-pointer rounded-none border-l p-0"
          onClick={() => handleStep(-0.1)}
          disabled={isAtMin}
          aria-label={`Disminuir ${label.toLowerCase()}`}
        >
          <Minus className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="border-input text-muted-foreground hover:text-foreground h-full w-8 cursor-pointer rounded-none border-l p-0"
          onClick={() => handleStep(0.1)}
          disabled={isAtMax}
          aria-label={`Aumentar ${label.toLowerCase()}`}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
