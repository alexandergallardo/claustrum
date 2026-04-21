import { useState, useCallback } from "react";
import { Upload, FileText, X, AlertTriangle } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUploadExam } from "@/lib/hooks/use-exams";
import { EXAM_TYPE_LABELS } from "@/lib/exams/types";
import type { ExamType } from "@/lib/exams/types";
import { toast } from "sonner";

interface ExamUploadDialogProps {
  courseId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const EXAM_TYPES: ExamType[] = [
  "parcial_1",
  "parcial_2",
  "parcial_3",
  "quizz",
  "final",
  "tarea",
  "proyecto",
  "otro",
];

export function ExamUploadDialog({
  courseId,
  open,
  onOpenChange,
}: ExamUploadDialogProps) {
  const [examType, setExamType] = useState<ExamType>("parcial_1");
  const [isCatedra, setIsCatedra] = useState(true);
  const [includesAnswers, setIncludesAnswers] = useState(false);
  const [hasSeparateAnswers, setHasSeparateAnswers] = useState(false);
  const [examFile, setExamFile] = useState<File | null>(null);
  const [answersFile, setAnswersFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadMutation = useUploadExam();

  const validateFile = useCallback((file: File): string | null => {
    if (file.type !== "application/pdf") {
      return "Solo se permiten archivos PDF.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "El archivo no debe superar los 10 MB.";
    }
    return null;
  }, []);

  const handleExamFileChange = useCallback(
    (file: File | null) => {
      if (!file) {
        setExamFile(null);
        return;
      }
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        return;
      }
      setExamFile(file);
    },
    [validateFile]
  );

  const handleAnswersFileChange = useCallback(
    (file: File | null) => {
      if (!file) {
        setAnswersFile(null);
        return;
      }
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        return;
      }
      setAnswersFile(file);
    },
    [validateFile]
  );

  const handleSubmit = async () => {
    if (!examFile) {
      toast.error("Debes seleccionar el archivo del examen.");
      return;
    }
    if (hasSeparateAnswers && !answersFile) {
      toast.error("Debes seleccionar el archivo de respuestas.");
      return;
    }

    try {
      await uploadMutation.mutateAsync({
        courseId,
        academicTermId: null,
        professorId: null,
        examType,
        isCatedra,
        includesAnswers,
        hasSeparateAnswers,
        examFile,
        answersFile: answersFile ?? undefined,
      });
      toast.success("Examen subido correctamente. Queda pendiente de moderación.");
      onOpenChange(false);
      setExamFile(null);
      setAnswersFile(null);
      setIncludesAnswers(false);
      setHasSeparateAnswers(false);
    } catch {
      toast.error("Error al subir el examen. Intenta de nuevo.");
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent, target: "exam" | "answers") => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0] ?? null;
      if (target === "exam") {
        handleExamFileChange(file);
      } else {
        handleAnswersFileChange(file);
      }
    },
    [handleExamFileChange, handleAnswersFileChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Subir examen o evaluación</DialogTitle>
          <DialogDescription>
            Tu aporte quedará pendiente de moderación antes de ser público.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label htmlFor="exam-type">Tipo de evaluación</Label>
            <Select value={examType} onValueChange={(v) => setExamType(v as ExamType)}>
              <SelectTrigger id="exam-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXAM_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {EXAM_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="is-catedra"
              checked={isCatedra}
              onCheckedChange={(checked) => setIsCatedra(Boolean(checked))}
            />
            <Label htmlFor="is-catedra" className="text-sm font-normal">
              Es cátedra (examen común para todos los grupos)
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="includes-answers"
              checked={includesAnswers}
              onCheckedChange={(checked) => {
                setIncludesAnswers(Boolean(checked));
                if (!checked) setHasSeparateAnswers(false);
              }}
            />
            <Label htmlFor="includes-answers" className="text-sm font-normal">
              Incluye respuestas
            </Label>
          </div>

          {includesAnswers && (
            <div className="flex items-center gap-2 pl-6">
              <Checkbox
                id="separate-answers"
                checked={hasSeparateAnswers}
                onCheckedChange={(checked) => {
                  setHasSeparateAnswers(Boolean(checked));
                  if (!checked) setAnswersFile(null);
                }}
              />
              <Label htmlFor="separate-answers" className="text-sm font-normal">
                Respuestas en archivo aparte
              </Label>
            </div>
          )}

          <FileDropZone
            label="Archivo del examen (PDF, máx. 10 MB)"
            file={examFile}
            onFileChange={handleExamFileChange}
            isDragging={isDragging}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => handleDrop(e, "exam")}
          />

          {hasSeparateAnswers && (
            <FileDropZone
              label="Archivo de respuestas (PDF, máx. 10 MB)"
              file={answersFile}
              onFileChange={handleAnswersFileChange}
              isDragging={isDragging}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => handleDrop(e, "answers")}
            />
          )}

          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              Solo se permiten archivos PDF. El contenido será revisado antes de publicarse.
              Asegúrate de tener permiso para compartir este material.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!examFile || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? "Subiendo..." : "Subir examen"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FileDropZone({
  label,
  file,
  onFileChange,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  label: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      {file ? (
        <div className="flex items-center gap-2 rounded-md border px-3 py-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 truncate text-sm">{file.name}</span>
          <span className="text-xs text-muted-foreground">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onFileChange(null)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-6 transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Arrastra un archivo aquí o haz clic para seleccionar
          </p>
          <Input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            id={`file-input-${label}`}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              document.getElementById(`file-input-${label}`)?.click()
            }
          >
            Seleccionar PDF
          </Button>
        </div>
      )}
    </div>
  );
}
