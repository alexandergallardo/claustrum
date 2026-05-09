import { useDebouncedValue } from "@tanstack/react-pacer";
import { Link } from "@tanstack/react-router";
import { Minus, Plus, Search } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useProfessorReviewCourseSearch } from "@/lib/hooks/use-professor-reviews";
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
  courseCode: string;
  setCourseCode: (value: string) => void;
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
  courseCode,
  setCourseCode,
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
  const [courseQuery, setCourseQuery] = useState(courseCode);
  const [isCourseSearchFocused, setIsCourseSearchFocused] = useState(false);
  const parsedEngagementLevel = Number(engagementLevel);
  const clampedEngagementLevel = Number.isFinite(parsedEngagementLevel)
    ? Math.min(5, Math.max(1, Math.round(parsedEngagementLevel)))
    : 4;
  const [debouncedCourseQuery, courseQueryDebouncer] = useDebouncedValue(
    courseQuery,
    { wait: 300 },
    (state) => ({ isPending: state.isPending }),
  );
  const courseSearchQuery = useProfessorReviewCourseSearch(debouncedCourseQuery);
  const courseOptions = courseSearchQuery.data ?? [];
  const normalizedCourseQuery = courseQuery.trim();
  const showCourseOptions =
    isCourseSearchFocused &&
    normalizedCourseQuery.length >= 2 &&
    (courseSearchQuery.isFetching ||
      courseQueryDebouncer.state.isPending ||
      courseOptions.length > 0);

  useEffect(() => {
    if (!courseCode) return;
    if (courseCode === courseQuery) return;
    setCourseQuery(courseCode);
  }, [courseCode, courseQuery]);

  const handleCourseQueryChange = (value: string) => {
    const normalizedValue = value.toUpperCase();
    const matchedCourseCode = normalizedValue.match(/^[A-Z]{2,4}\d{3,4}/)?.[0] ?? "";

    setIsCourseSearchFocused(true);
    setCourseQuery(normalizedValue);
    setCourseCode(matchedCourseCode);
  };

  const handleCourseSelect = (selectedCourse: { code: string; name: string }) => {
    setCourseCode(selectedCourse.code);
    setCourseQuery(`${selectedCourse.code}: ${selectedCourse.name}`);
    setIsCourseSearchFocused(false);
  };

  const form = (
    <div className={`space-y-4 ${isMobile ? "px-4 pb-4" : "px-1 pb-2"}`}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="composer-course-code">Curso</Label>
          <div className="relative">
            <InputGroup className="h-10">
              <InputGroupInput
                id="composer-course-code"
                className="text-sm md:text-sm"
                placeholder="Busca por código o nombre del curso"
                value={courseQuery}
                onFocus={() => setIsCourseSearchFocused(true)}
                onBlur={() => {
                  window.setTimeout(() => setIsCourseSearchFocused(false), 100);
                }}
                onChange={(event) => handleCourseQueryChange(event.target.value)}
                autoComplete="off"
              />
              <InputGroupAddon>
                <Search className="size-4" />
              </InputGroupAddon>
            </InputGroup>

            {showCourseOptions ? (
              <div className="bg-popover text-popover-foreground absolute top-[calc(100%+0.5rem)] z-20 max-h-52 w-full overflow-hidden rounded-md border shadow-md">
                <ScrollArea
                  className={cn(
                    "max-h-52",
                    courseOptions.length >= 6 ||
                      courseQueryDebouncer.state.isPending ||
                      courseSearchQuery.isFetching
                      ? "h-52"
                      : "h-auto",
                  )}
                >
                  {courseQueryDebouncer.state.isPending || courseSearchQuery.isFetching ? (
                    <div className="text-muted-foreground px-3 py-2 text-sm">Buscando cursos…</div>
                  ) : null}

                  {!courseQueryDebouncer.state.isPending && !courseSearchQuery.isFetching
                    ? courseOptions.map((course) => (
                        <Tooltip key={course.id}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="hover:bg-accent hover:text-accent-foreground flex w-full items-center px-3 py-2 text-left text-sm"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => handleCourseSelect(course)}
                            >
                              <span className="truncate">
                                {course.code}: {course.name}
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" sideOffset={8}>
                            {course.name}
                          </TooltipContent>
                        </Tooltip>
                      ))
                    : null}

                  {!courseQueryDebouncer.state.isPending &&
                  !courseSearchQuery.isFetching &&
                  courseOptions.length === 0 ? (
                    <div className="text-muted-foreground px-3 py-2 text-sm">
                      No se encontraron cursos con ese criterio.
                    </div>
                  ) : null}
                </ScrollArea>
              </div>
            ) : null}
          </div>
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
