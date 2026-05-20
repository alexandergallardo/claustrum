import { FileUp, Minus, Plus, X } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { AcademicTerm, CourseRecentProfessor } from "@/lib/types";

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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { getTurnstileSiteKey } from "@/lib/env/public";
import {
  EVALUATION_TYPE_LABELS,
  EVALUATION_TYPES_WITH_NUMBER,
  type EvaluationType,
} from "@/lib/evaluations/types";
import { useUploadEvaluation } from "@/lib/hooks/use-evaluations";
import { useCourseOfferingTerms, useCourseRecentProfessors } from "@/lib/hooks/use-queries";
import { cn } from "@/lib/utils";

const Turnstile = lazy(() =>
  import("@marsidev/react-turnstile").then((module) => ({ default: module.Turnstile })),
);

interface EvaluationUploadDialogProps {
  courseId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EVALUATION_TYPES = Object.entries(EVALUATION_TYPE_LABELS) as [EvaluationType, string][];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EvaluationUploadDialog({
  courseId,
  open,
  onOpenChange,
}: EvaluationUploadDialogProps) {
  const uploadMutation = useUploadEvaluation();
  const isMobile = useIsMobile();
  const turnstileSiteKey = getTurnstileSiteKey();
  const comboboxPortalContainerRef = useRef<HTMLDivElement | null>(null);
  const termTriggerRef = useRef<HTMLButtonElement | null>(null);
  const professorTriggerRef = useRef<HTMLButtonElement | null>(null);

  const [evaluationFile, setEvaluationFile] = useState<File | null>(null);
  const [answersFile, setAnswersFile] = useState<File | null>(null);
  const [evaluationType, setEvaluationType] = useState<EvaluationType>("otro");
  const [evaluationNumberInput, setEvaluationNumberInput] = useState("");
  const [customName, setCustomName] = useState("");
  const [academicTermId, setAcademicTermId] = useState<string>("");
  const [professorId, setProfessorId] = useState<string>("");
  const [isCatedra, setIsCatedra] = useState(false);
  const [includesAnswers, setIncludesAnswers] = useState(false);
  const [hasSeparateAnswers, setHasSeparateAnswers] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const offeringTermsQuery = useCourseOfferingTerms(courseId, null, null);
  const selectedTermNumericId = academicTermId ? Number(academicTermId) : null;
  const normalizedTermId = Number.isInteger(selectedTermNumericId) ? selectedTermNumericId : null;
  const recentProfessorsQuery = useCourseRecentProfessors(courseId, null, null, normalizedTermId);

  const academicTerms = useMemo<AcademicTerm[]>(
    () => offeringTermsQuery.data ?? [],
    [offeringTermsQuery.data],
  );
  const recentProfessors = useMemo<CourseRecentProfessor[]>(
    () => (normalizedTermId ? (recentProfessorsQuery.data ?? []) : []),
    [normalizedTermId, recentProfessorsQuery.data],
  );

  const showNumberInput = EVALUATION_TYPES_WITH_NUMBER.includes(evaluationType);
  const showCustomNameInput = evaluationType === "otro";

  const canSubmit = useMemo(() => {
    if (!evaluationFile || !evaluationType || uploadMutation.isPending) return false;
    if (showCustomNameInput && customName.trim() === "") return false;
    if (!turnstileSiteKey || !turnstileToken) return false;
    return true;
  }, [
    evaluationFile,
    evaluationType,
    uploadMutation.isPending,
    showCustomNameInput,
    customName,
    turnstileSiteKey,
    turnstileToken,
  ]);

  const resetForm = useCallback(() => {
    setEvaluationFile(null);
    setAnswersFile(null);
    setEvaluationType("otro");
    setEvaluationNumberInput("");
    setCustomName("");
    setAcademicTermId("");
    setProfessorId("");
    setIsCatedra(false);
    setIncludesAnswers(false);
    setHasSeparateAnswers(false);
    setTurnstileToken(null);
  }, []);

  const handleClose = useCallback(
    (value: boolean) => {
      if (!value) resetForm();
      onOpenChange(value);
    },
    [onOpenChange, resetForm],
  );

  const validateFile = (file: File): string | null => {
    if (file.type !== "application/pdf") {
      return "El archivo debe ser un PDF.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return `El archivo excede el límite de 10 MB (${formatFileSize(file.size)}).`;
    }
    return null;
  };

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLElement>, type: "evaluation" | "answers") => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files[0];
      if (!file) return;
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        return;
      }
      if (type === "evaluation") setEvaluationFile(file);
      else setAnswersFile(file);
    },
    [],
  );

  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, type: "evaluation" | "answers") => {
      const file = event.target.files?.[0];
      if (!file) return;
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        return;
      }
      if (type === "evaluation") setEvaluationFile(file);
      else setAnswersFile(file);
    },
    [],
  );

  const handleEvaluationNumberChange = (value: string) => {
    if (value === "") {
      setEvaluationNumberInput("");
      return;
    }
    if (!/^\d+$/.test(value)) return;
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed <= 0) return;
    setEvaluationNumberInput(String(parsed));
  };

  const handleEvaluationNumberStep = (delta: number) => {
    const currentValue = evaluationNumberInput.trim() === "" ? 0 : Number(evaluationNumberInput);
    if (Number.isNaN(currentValue)) {
      setEvaluationNumberInput("1");
      return;
    }
    const nextValue = Math.max(1, currentValue + delta);
    setEvaluationNumberInput(String(nextValue));
  };

  const handleSubmit = async () => {
    if (!evaluationFile) return;

    const parsedTermId = academicTermId ? Number(academicTermId) : null;
    const parsedProfessorId = professorId ? Number(professorId) : null;
    const parsedEvaluationNumber =
      evaluationNumberInput.trim() === "" ? null : Number(evaluationNumberInput);
    const parsedCustomName = customName.trim() === "" ? null : customName.trim();

    try {
      await uploadMutation.mutateAsync({
        courseId,
        academicTermId: parsedTermId,
        professorId: parsedProfessorId,
        evaluationType,
        evaluationNumber: parsedEvaluationNumber,
        customName: parsedCustomName,
        isCatedra,
        includesAnswers,
        hasSeparateAnswers,
        turnstileToken: turnstileToken ?? "",
        evaluationFile,
        answersFile: hasSeparateAnswers ? answersFile : null,
      });

      toast.success("Evaluación subida correctamente. Estará visible tras ser moderada.");
      handleClose(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al subir la evaluación.");
    }
  };

  const selectedTerm = academicTerms.find((t) => String(t.id) === academicTermId) ?? null;
  const selectedProfessor =
    recentProfessors.find((p) => String(p.professorId) === professorId) ?? null;

  useEffect(() => {
    if (!academicTermId && academicTerms.length > 0) {
      setAcademicTermId(String(academicTerms[0].id));
      return;
    }

    if (academicTermId && !academicTerms.some((term) => String(term.id) === academicTermId)) {
      setAcademicTermId(academicTerms.length > 0 ? String(academicTerms[0].id) : "");
    }
  }, [academicTermId, academicTerms]);

  useEffect(() => {
    if (professorId && !recentProfessors.some((p) => String(p.professorId) === professorId)) {
      setProfessorId("");
    }
  }, [professorId, recentProfessors]);

  const formFields = (
    <div className="space-y-5">
      {/* Evaluation file drop zone */}
      <div className="space-y-2">
        <Label>Archivo de la evaluación</Label>
        {!evaluationFile ? (
          <button
            type="button"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => handleDrop(e, "evaluation")}
            className={`w-full cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
            onClick={() => document.getElementById("evaluation-file-input")?.click()}
          >
            <FileUp className="text-muted-foreground mx-auto mb-2 size-6" />
            <p className="text-muted-foreground text-sm">
              Arrastra un PDF aquí o haz clic para seleccionar
            </p>
            <p className="text-muted-foreground mt-1 text-xs">Máximo 10 MB</p>
          </button>
        ) : (
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{evaluationFile.name}</p>
              <p className="text-muted-foreground text-xs">{formatFileSize(evaluationFile.size)}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEvaluationFile(null)}
              aria-label="Quitar archivo"
            >
              <X className="size-4" />
            </Button>
          </div>
        )}
        <input
          id="evaluation-file-input"
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFileInput(e, "evaluation")}
        />
      </div>

      {/* Type + Number / Custom name */}
      <div className="space-y-2">
        <Label htmlFor="evaluation-type">Tipo de evaluación</Label>
        <div className="flex gap-3">
          <Select
            value={evaluationType}
            onValueChange={(v) => {
              setEvaluationType(v as EvaluationType);
              setEvaluationNumberInput("");
              setCustomName("");
            }}
          >
            <SelectTrigger id="evaluation-type" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {EVALUATION_TYPES.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {showNumberInput && (
            <div className="flex flex-1 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleEvaluationNumberStep(-1)}
                aria-label="Disminuir número"
              >
                <Minus className="size-4" />
              </Button>
              <Input
                className="min-w-0 overflow-hidden text-center text-ellipsis whitespace-nowrap [&::placeholder]:overflow-hidden [&::placeholder]:text-ellipsis [&::placeholder]:whitespace-nowrap"
                type="text"
                inputMode="numeric"
                value={evaluationNumberInput}
                onChange={(event) => handleEvaluationNumberChange(event.target.value)}
                placeholder="Número de evaluación"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => handleEvaluationNumberStep(1)}
                aria-label="Aumentar número"
              >
                <Plus className="size-4" />
              </Button>
            </div>
          )}

          {showCustomNameInput && (
            <div className="flex flex-1 items-center gap-2">
              <Input
                className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap [&::placeholder]:overflow-hidden [&::placeholder]:text-ellipsis [&::placeholder]:whitespace-nowrap"
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                placeholder="Nombre de la evaluación"
                maxLength={100}
              />
            </div>
          )}
        </div>
      </div>

      {/* Period + Professor */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Período académico</Label>
          <Combobox
            items={academicTerms}
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
                  disabled={academicTerms.length === 0}
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
                  (offeringTermsQuery.isLoading
                    ? "Cargando períodos..."
                    : "Sin períodos con oferta")}
              </span>
            </ComboboxTrigger>
            <ComboboxContent
              anchor={termTriggerRef}
              container={comboboxPortalContainerRef}
              className="w-64"
            >
              <ComboboxInput showTrigger={false} placeholder="Buscar período..." />
              <ComboboxEmpty>No se encontraron períodos.</ComboboxEmpty>
              <ComboboxList className="max-h-48 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {(term) => (
                  <ComboboxItem key={term.id} value={term}>
                    <span className="block min-w-0 flex-1 truncate">{term.display_name}</span>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>

        <div className="space-y-2">
          <Label>Profesor</Label>
          <Combobox
            items={recentProfessors}
            value={selectedProfessor}
            onValueChange={(prof) => setProfessorId(prof ? String(prof.professorId) : "")}
            itemToStringValue={(prof) => prof.professorName}
          >
            <ComboboxTrigger
              ref={professorTriggerRef}
              render={
                <Button
                  variant="outline"
                  className="w-full min-w-0 justify-between overflow-hidden font-normal"
                  disabled={!selectedTerm || recentProfessorsQuery.isLoading}
                />
              }
            >
              <span
                className={cn(
                  "block min-w-0 flex-1 truncate text-left",
                  !selectedProfessor && "text-muted-foreground",
                )}
              >
                {selectedProfessor?.professorName ??
                  (!selectedTerm
                    ? "Selecciona un período"
                    : recentProfessorsQuery.isLoading
                      ? "Cargando profesores..."
                      : recentProfessors.length > 0
                        ? "Seleccionar profesor"
                        : "Sin profesores en este período")}
              </span>
            </ComboboxTrigger>
            <ComboboxContent
              anchor={professorTriggerRef}
              container={comboboxPortalContainerRef}
              className="w-64"
            >
              <ComboboxInput showTrigger={false} placeholder="Buscar profesor..." />
              <ComboboxEmpty>No se encontraron profesores.</ComboboxEmpty>
              <ComboboxList className="max-h-48 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {(prof) => (
                  <ComboboxItem key={prof.professorId} value={prof}>
                    <span className="block min-w-0 flex-1 truncate">{prof.professorName}</span>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
      </div>

      {/* Checkboxes */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="is-catedra"
            checked={isCatedra}
            onCheckedChange={(v) => setIsCatedra(v === true)}
          />
          <Label htmlFor="is-catedra" className="text-sm font-normal">
            Es de cátedra
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="includes-answers"
            checked={includesAnswers}
            onCheckedChange={(v) => setIncludesAnswers(v === true)}
          />
          <Label htmlFor="includes-answers" className="text-sm font-normal">
            Incluye respuestas o solucionario
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="has-separate-answers"
            checked={hasSeparateAnswers}
            onCheckedChange={(v) => setHasSeparateAnswers(v === true)}
          />
          <Label htmlFor="has-separate-answers" className="text-sm font-normal">
            Respuestas en archivo aparte
          </Label>
        </div>
      </div>

      {/* Answers file */}
      {hasSeparateAnswers && (
        <div className="space-y-2">
          <Label>Archivo de respuestas (PDF)</Label>
          {!answersFile ? (
            <button
              type="button"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => handleDrop(e, "answers")}
              className={`w-full cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
              onClick={() => document.getElementById("answers-file-input")?.click()}
            >
              <p className="text-muted-foreground text-sm">
                Arrastra el PDF de respuestas aquí o haz clic
              </p>
              <p className="text-muted-foreground mt-1 text-xs">Máximo 10 MB</p>
            </button>
          ) : (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{answersFile.name}</p>
                <p className="text-muted-foreground text-xs">{formatFileSize(answersFile.size)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setAnswersFile(null)}
                aria-label="Quitar archivo"
              >
                <X className="size-4" />
              </Button>
            </div>
          )}
          <input
            id="answers-file-input"
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => handleFileInput(e, "answers")}
          />
        </div>
      )}

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
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent side="bottom" className="h-[90vh] overflow-hidden p-0">
          <div ref={comboboxPortalContainerRef} className="absolute top-0 left-0 size-0" />
          <SheetHeader>
            <SheetTitle>Subir evaluación</SheetTitle>
            <SheetDescription>Comparte material de estudio con otros estudiantes.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {formFields}
            <div className="mt-5">
              <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
                {uploadMutation.isPending ? "Subiendo..." : "Subir evaluación"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <div ref={comboboxPortalContainerRef} className="absolute top-0 left-0 size-0" />
        <DialogHeader>
          <DialogTitle>Subir evaluación</DialogTitle>
          <DialogDescription>Comparte material de estudio con otros estudiantes.</DialogDescription>
        </DialogHeader>

        {formFields}

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {uploadMutation.isPending ? "Subiendo..." : "Subir evaluación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
