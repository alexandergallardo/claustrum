import { lazy, Suspense, useState } from "react";
import { Minus, Plus } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { REVIEW_TAG_OPTIONS, type ReviewTag } from "@/lib/professor-reviews/types";

const Turnstile = lazy(() => import("@marsidev/react-turnstile").then((module) => ({ default: module.Turnstile })));

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
  const parsedEngagementLevel = Number(engagementLevel);
  const clampedEngagementLevel = Number.isFinite(parsedEngagementLevel)
    ? Math.min(5, Math.max(1, Math.round(parsedEngagementLevel)))
    : 4;

  const form = (
    <div className={`space-y-4 overflow-y-auto ${isMobile ? "px-4 pb-4" : "px-0 pb-2"}`}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="composer-course-code">Código de curso</Label>
          <Input
            id="composer-course-code"
            placeholder="CI1230"
            value={courseCode}
            onChange={(event) => setCourseCode(event.target.value.toUpperCase())}
          />
        </div>
        <div className="space-y-2">
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
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Ejemplo de reseña útil</p>
            <p className="mt-1">
              "Su método de enseñanza se basa en clase invertida. La teoría se revisa antes y en clase se trabaja con
              problemas aplicados. La retroalimentación fue clara y me ayudó a corregir errores rápido. Recomiendo
              llegar con la lectura hecha y practicar ejercicios cada semana."
            </p>
          </div>
        ) : null}
        <Textarea
          id="composer-comment"
          maxLength={1000}
          placeholder="Describe método de enseñanza, evaluación y recomendaciones prácticas para futuros estudiantes"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">{comment.length}/1000</p>
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
            <span className={`text-sm font-medium ${clampedEngagementLevel >= 4 ? "text-green-600" : clampedEngagementLevel <= 2 ? "text-red-600" : "text-amber-600"}`}>
              {clampedEngagementLevel <= 2 ? "Bajo" : clampedEngagementLevel >= 4 ? "Alto" : "Medio"}
            </span>
          </div>
          <div className="flex h-9 items-center">
            <Slider
              className="-translate-y-px w-full [&_[data-slot=slider-track]]:bg-gradient-to-r [&_[data-slot=slider-track]]:from-red-500 [&_[data-slot=slider-track]]:to-green-500 [&_[data-slot=slider-range]]:bg-transparent"
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
              <label className="inline-flex items-center gap-2 text-sm">
                <RadioGroupItem value="yes" id="composer-attendance-yes" />
                Sí
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
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
              <Suspense fallback={<span className="text-sm text-muted-foreground">Cargando verificación...</span>}>
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
        <Button onClick={onSubmit} disabled={submitMutationPending || !turnstileSiteKey || !turnstileToken}>
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
        <SheetContent side="bottom" className="max-h-[90vh] overflow-hidden">
          <SheetHeader>
            <SheetTitle>Enviar reseña</SheetTitle>
            <SheetDescription>Tu reseña es anónima y requiere aprobación antes de publicarse.</SheetDescription>
          </SheetHeader>
          {form}
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Enviar reseña</DialogTitle>
          <DialogDescription>Tu reseña es anónima y requiere aprobación antes de publicarse.</DialogDescription>
        </DialogHeader>
        {form}
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
      <div className="border-input focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] flex h-9 w-full items-center overflow-hidden rounded-md border bg-transparent transition-[color,box-shadow]">
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
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="border-input text-muted-foreground hover:text-foreground h-full w-8 cursor-pointer rounded-none border-l p-0"
          onClick={() => handleStep(0.1)}
          disabled={isAtMax}
          aria-label={`Aumentar ${label.toLowerCase()}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
