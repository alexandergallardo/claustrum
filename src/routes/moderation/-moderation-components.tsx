import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";

import type { EvaluationModerationRow } from "@/lib/evaluations/types";
import type {
  ProfessorReviewModerationRow,
  ProfessorReviewReportModerationRow,
} from "@/lib/professor-reviews/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { lazy, Suspense } from "react";

const PdfViewer = lazy(() =>
  import("@/components/pdf-viewer").then((mod) => ({ default: mod.PdfViewer })),
);
import { getEvaluationAnswersDocument, getEvaluationDocument } from "@/lib/evaluations/api";
import { formatEvaluationFileName, formatEvaluationTypeLabel } from "@/lib/evaluations/types";



function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatScore(value: number | null): string {
  return value === null ? "-" : value.toFixed(1);
}



function ReviewCourses({ review }: { review: ProfessorReviewModerationRow }) {
  return (
    <div className="space-y-1">
      {review.courses.map((course) => (
        <p key={`${review.review_id}-${course.id}`} className="text-sm text-muted-foreground break-words">
          {course.code}: {course.name}
        </p>
      ))}
    </div>
  );
}

function ReviewScoreSummary({ review }: { review: ProfessorReviewModerationRow }) {
  const scores = [
    { label: "Facilidad", value: formatScore(review.ease_score) },
    { label: "Calidad", value: formatScore(review.quality_score) },
    ...(review.clarity_score !== null ? [{ label: "Claridad", value: formatScore(review.clarity_score) }] : []),
    ...(review.fairness_score !== null ? [{ label: "Justicia", value: formatScore(review.fairness_score) }] : []),
    ...(review.attendance_required !== null ? [{ label: "Asistencia", value: review.attendance_required ? "Obligatoria" : "No obligatoria" }] : []),
    ...(review.grade_received !== null ? [{ label: "Nota", value: review.grade_received }] : []),
    ...(review.engagement_level !== null ? [{ label: "Interés", value: review.engagement_level }] : []),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {scores.map((s, i) => (
        <div key={i} className="bg-muted text-muted-foreground flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs">
          <span className="font-medium">{s.label}:</span>
          <span>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ReviewReportSection({
  rows,
  selectedReport,
  onSelect,
  page,
  hasMore,
  isLoading,
  isFetching,
  onPageChange,
  moderationNote,
  onNoteChange,
  onResolve,
  onDismiss,
  isPending,
}: {
  rows: ProfessorReviewReportModerationRow[];
  selectedReport: ProfessorReviewReportModerationRow | null;
  onSelect: (id: number | null) => void;
  page: number;
  hasMore: boolean;
  isLoading: boolean;
  isFetching: boolean;
  onPageChange: (page: number) => void;
  moderationNote: Record<number, string>;
  onNoteChange: (id: number, value: string) => void;
  onResolve: (id: number) => Promise<void>;
  onDismiss: (id: number) => Promise<void>;
  isPending: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <div
        className={cn(
          "bg-card shadow-xs flex min-h-0 shrink-0 w-full flex-col overflow-hidden rounded-xl border lg:w-72 xl:w-80",
          selectedReport && "hidden lg:flex",
        )}
      >
        <div className="flex items-center justify-between border-b p-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={page === 0 || isFetching}
            onClick={() => onPageChange(Math.max(page - 1, 0))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium">
            Página {(page + 1).toString().padStart(2, "0")}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={!hasMore || isFetching}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center p-4">
              <Loader2 className="text-muted-foreground size-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground p-4 text-center text-sm">
              No hay reportes pendientes.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {rows.map((report) => (
                <button
                  key={report.report_id}
                  type="button"
                  onClick={() => onSelect(report.report_id)}
                  className={cn(
                    "flex w-full flex-col rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    selectedReport?.report_id === report.report_id
                      ? "border-foreground/30 bg-accent"
                      : "hover:bg-muted border-transparent",
                  )}
                >
                  <span className="truncate font-medium">
                    {report.course_code}: {report.course_name}
                  </span>
                  <div className="mt-1 flex w-full items-end justify-between gap-2">
                    <span className="text-muted-foreground truncate text-sm">
                      {report.professor_name}
                    </span>
                  </div>
                  <span className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                    {report.reason}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedReport && (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:max-h-full lg:overflow-y-auto">
          <div className="flex flex-col gap-2 sm:hidden">
            <h2 className="text-sm font-semibold">Reporte</h2>
            <Button variant="ghost" size="sm" onClick={() => onSelect(null)} className="w-fit">
              Volver
            </Button>
          </div>

          <div className="bg-card text-card-foreground shadow-xs flex flex-col overflow-hidden rounded-xl border">
            <div className="flex flex-col gap-3 p-5 md:p-6">
              <div className="space-y-1">
                <h3 className="text-xl font-semibold leading-none tracking-tight">
                  {selectedReport.course_code}: {selectedReport.course_name}
                </h3>
              </div>

              <div className="relative mt-2">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="border-border/50 w-full border-t"></div>
                </div>
              </div>

              <div className="text-muted-foreground flex flex-col gap-1.5 text-xs">
                <span>
                  <strong>Profesor:</strong> {selectedReport.professor_name}
                </span>
                <span>
                  <strong>Motivo:</strong> {selectedReport.reason}
                </span>
                {selectedReport.description && (
                  <span>
                    <strong>Detalles adicionales:</strong> {selectedReport.description}
                  </span>
                )}
              </div>

              <div className="mt-2 space-y-1.5">
                <h4 className="text-sm font-medium">Comentario reportado</h4>
                <div className="bg-muted/50 rounded-md border p-3 text-sm">
                  {selectedReport.comment}
                </div>
              </div>
            </div>

            <div className="bg-muted/30 flex flex-col gap-3 border-t p-4 md:p-5">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor={`note-report-${selectedReport.report_id}`}
                  className="text-sm font-medium"
                >
                  Nota de resolución
                </Label>
                <Textarea
                  id={`note-report-${selectedReport.report_id}`}
                  value={moderationNote[selectedReport.report_id] ?? ""}
                  onChange={(e) => onNoteChange(selectedReport.report_id, e.target.value)}
                  className="bg-background h-20 min-h-0 resize-none text-sm shadow-none"
                  placeholder="Escribe una nota opcional para explicar el contexto de la decisión"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  onClick={() => void onResolve(selectedReport.report_id)}
                  disabled={isPending}
                >
                  <Check className="mr-2 size-4" /> Resolver
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => void onDismiss(selectedReport.report_id)}
                  disabled={isPending}
                >
                  <X className="mr-2 size-4" /> Descartar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



export function ReviewSection({
  rows,
  selectedReview,
  onSelect,
  page,
  hasMore,
  isLoading,
  isFetching,
  onPageChange,
  moderationNote,
  onNoteChange,
  onApprove,
  onReject,
  isPending,
}: {
  rows: ProfessorReviewModerationRow[];
  selectedReview: ProfessorReviewModerationRow | null;
  onSelect: (id: number | null) => void;
  page: number;
  hasMore: boolean;
  isLoading: boolean;
  isFetching: boolean;
  onPageChange: (page: number) => void;
  moderationNote: Record<number, string>;
  onNoteChange: (id: number, value: string) => void;
  onApprove: (id: number) => Promise<void>;
  onReject: (id: number) => Promise<void>;
  isPending: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <div
        className={cn(
          "bg-card text-card-foreground shadow-xs flex min-h-0 shrink-0 w-full flex-col overflow-hidden rounded-xl border lg:w-72 xl:w-80",
          selectedReview && "hidden lg:flex"
        )}
      >
        <div className="flex items-center justify-between border-b p-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={page === 0 || isFetching}
            onClick={() => onPageChange(Math.max(page - 1, 0))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium">
            Página {(page + 1).toString().padStart(2, "0")}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={!hasMore || isFetching}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
          {isLoading ? (
            <p className="text-muted-foreground p-3 text-center text-sm">Cargando reseñas…</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground p-3 text-center text-sm">No hay reseñas pendientes.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {rows.map((review) => (
                <button
                  key={review.review_id}
                  type="button"
                  onClick={() => onSelect(review.review_id)}
                  className={cn(
                    "flex w-full flex-col rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    selectedReview?.review_id === review.review_id
                      ? "border-foreground/30 bg-accent"
                      : "hover:bg-muted border-transparent",
                  )}
                >
                  <span className="truncate font-medium">{review.professor_name}</span>
                  <div className="text-muted-foreground mt-1 flex flex-col text-sm">
                    {review.courses.map((course) => (
                      <span key={course.id} className="truncate">
                        {course.code}: {course.name}
                      </span>
                    ))}
                  </div>
                  <span className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                    {review.comment}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedReview && (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:max-h-full lg:overflow-y-auto">
          <div className="flex items-start justify-between gap-2 sm:hidden">
            <h2 className="text-sm font-semibold">Revisión</h2>
            <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
              Volver
            </Button>
          </div>

          <div className="bg-card text-card-foreground shadow-xs flex flex-col overflow-hidden rounded-xl border">
            <div className="flex flex-col gap-3 p-5 md:p-6">
              <div className="space-y-1">
                <h3 className="text-xl font-semibold leading-none tracking-tight">
                  {selectedReview.professor_name}
                </h3>
                <div className="pt-2">
                  <ReviewCourses review={selectedReview} />
                </div>
              </div>

              <div className="relative mt-2">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="border-border/50 w-full border-t"></div>
                </div>
              </div>

              <blockquote className="border-primary/50 text-muted-foreground my-2 border-l-2 pl-4 italic">
                "{selectedReview.comment}"
              </blockquote>

              <ReviewScoreSummary review={selectedReview} />

              {selectedReview.tags && selectedReview.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {selectedReview.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="font-normal">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-muted/30 flex flex-col gap-3 border-t p-4 md:p-5">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor={`note-review-${selectedReview.review_id}`}
                  className="text-sm font-medium"
                >
                  Nota de moderación
                </Label>
                <Textarea
                  id={`note-review-${selectedReview.review_id}`}
                  value={moderationNote[selectedReview.review_id] ?? ""}
                  onChange={(e) => onNoteChange(selectedReview.review_id, e.target.value)}
                  className="bg-background h-20 min-h-0 resize-none text-sm shadow-none"
                  placeholder="Escribe una nota opcional para explicar el motivo del rechazo"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  onClick={() => void onApprove(selectedReview.review_id)}
                  disabled={isPending}
                >
                  <Check className="mr-2 size-4" /> Aprobar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => void onReject(selectedReview.review_id)}
                  disabled={isPending}
                >
                  <X className="mr-2 size-4" /> Rechazar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EvaluationPdfViewer({
  selectedEvaluation,
}: {
  selectedEvaluation: EvaluationModerationRow;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [answersBlobUrl, setAnswersBlobUrl] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"evaluation" | "answers">("evaluation");

  useEffect(() => {
    setBlobUrl(null);
    setAnswersBlobUrl(null);
    setFileError(null);
    setActiveTab("evaluation");

    let cancelled = false;
    let evalUrl: string | null = null;
    let answersUrl: string | null = null;

    async function loadFiles() {
      setFileLoading(true);
      try {
        const evalResult = await getEvaluationDocument(selectedEvaluation.id);
        if (cancelled) return;
        evalUrl = URL.createObjectURL(evalResult.blob);
        setBlobUrl(evalUrl);

        if (selectedEvaluation.has_separate_answers) {
          const answersResult = await getEvaluationAnswersDocument(selectedEvaluation.id);
          if (cancelled) return;
          answersUrl = URL.createObjectURL(answersResult.blob);
          setAnswersBlobUrl(answersUrl);
        }
      } catch (err) {
        if (!cancelled) setFileError(err instanceof Error ? err.message : "Error al cargar PDF");
      } finally {
        if (!cancelled) setFileLoading(false);
      }
    }

    void loadFiles();

    return () => {
      cancelled = true;
      if (evalUrl) URL.revokeObjectURL(evalUrl);
      if (answersUrl) URL.revokeObjectURL(answersUrl);
    };
  }, [selectedEvaluation]);

  const baseFileName = formatEvaluationFileName(
    selectedEvaluation.course_code,
    selectedEvaluation.evaluation_type,
    selectedEvaluation.evaluation_number,
    selectedEvaluation.custom_name,
  );
  const answersFileName = baseFileName.replace(".pdf", "-respuestas.pdf");

  return (
    <div className="bg-card text-card-foreground shadow-xs flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border">
      {selectedEvaluation.has_separate_answers && (
        <div className="border-border/50 flex border-b">
          <button
            onClick={() => setActiveTab("evaluation")}
            className={cn(
              "flex-1 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/50",
              activeTab === "evaluation" ? "bg-muted text-foreground" : "text-muted-foreground",
            )}
          >
            Evaluación
          </button>
          <button
            onClick={() => setActiveTab("answers")}
            className={cn(
              "flex-1 border-l border-border/50 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted/50",
              activeTab === "answers" ? "bg-muted text-foreground" : "text-muted-foreground",
            )}
          >
            Respuestas
          </button>
        </div>
      )}

      {fileLoading && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Loader2 className="text-muted-foreground size-8 animate-spin" />
          <p className="text-muted-foreground text-sm">Cargando documento…</p>
        </div>
      )}

      {!fileLoading && fileError && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-destructive text-sm">{fileError}</p>
        </div>
      )}

      {!fileLoading && !fileError && (
        <Suspense fallback={
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <Loader2 className="text-muted-foreground size-8 animate-spin" />
            <p className="text-muted-foreground text-sm">Cargando visor…</p>
          </div>
        }>
          {activeTab === "evaluation" && blobUrl && (
            <PdfViewer blobUrl={blobUrl} fileName={baseFileName} className="h-full rounded-b-xl" />
          )}
          {activeTab === "answers" && answersBlobUrl && (
            <PdfViewer
              blobUrl={answersBlobUrl}
              fileName={answersFileName}
              className="h-full rounded-b-xl"
            />
          )}
        </Suspense>
      )}
    </div>
  );
}

export function EvaluationSection({
  rows,
  selectedEvaluation,
  onSelect,
  page,
  hasMore,
  isLoading,
  isFetching,
  onPageChange,
  moderationNote,
  onNoteChange,
  onApprove,
  onReject,
  isPending,
}: {
  rows: EvaluationModerationRow[];
  selectedEvaluation: EvaluationModerationRow | null;
  onSelect: (id: number | null) => void;
  page: number;
  hasMore: boolean;
  isLoading: boolean;
  isFetching: boolean;
  onPageChange: (page: number) => void;
  moderationNote: Record<number, string>;
  onNoteChange: (id: number, value: string) => void;
  onApprove: (id: number) => Promise<void>;
  onReject: (id: number) => Promise<void>;
  isPending: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <div
        className={cn(
          "bg-card text-card-foreground shadow-xs flex min-h-0 shrink-0 w-full flex-col overflow-hidden rounded-xl border lg:w-72 xl:w-80",
          selectedEvaluation && "hidden lg:flex"
        )}
      >
        <div className="flex items-center justify-between border-b p-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={page === 0 || isFetching}
            onClick={() => onPageChange(Math.max(page - 1, 0))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium">
            Página {(page + 1).toString().padStart(2, "0")}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={!hasMore || isFetching}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
          {isLoading ? (
            <p className="text-muted-foreground p-3 text-center text-sm">Cargando evaluaciones…</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground p-3 text-center text-sm">No hay evaluaciones pendientes.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {rows.map((evaluation) => (
                <button
                  key={evaluation.id}
                  type="button"
                  onClick={() => onSelect(evaluation.id)}
                  className={cn(
                    "flex w-full flex-col rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    selectedEvaluation?.id === evaluation.id
                      ? "border-foreground/30 bg-accent"
                      : "hover:bg-muted border-transparent",
                  )}
                >
                  <span className="truncate font-medium">
                    {evaluation.course_code}: {evaluation.course_name}
                  </span>
                  <div className="mt-1 flex w-full items-end justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-muted-foreground truncate text-sm">
                        {formatEvaluationFileName(
                          evaluation.course_code,
                          evaluation.evaluation_type,
                          evaluation.evaluation_number,
                          evaluation.custom_name,
                        )}
                      </span>
                      <span className="text-muted-foreground truncate text-xs">
                        {evaluation.professor_name ?? "—"}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 whitespace-nowrap text-xs">
                      <span className="text-muted-foreground">
                        {evaluation.term_display_name ? evaluation.term_display_name.replace(" - ", ": ") : "—"}
                      </span>
                      <span className="text-muted-foreground font-mono">
                        {formatFileSize(evaluation.file_size)}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedEvaluation && (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:flex-row">
          <div className="flex flex-col gap-2 sm:hidden">
            <h2 className="text-sm font-semibold">Revisión</h2>
            <Button variant="ghost" size="sm" onClick={() => onSelect(null)} className="w-fit">
              Volver
            </Button>
          </div>

          <div className="bg-card text-card-foreground shadow-xs flex min-h-0 shrink-0 flex-col overflow-y-auto overflow-x-hidden rounded-xl border lg:w-80">
            <div className="flex flex-col gap-3 p-5 md:p-6">
              <div className="space-y-1">
                <h3 className="text-xl font-semibold leading-none tracking-tight">
                  {selectedEvaluation.course_code}: {selectedEvaluation.course_name}
                </h3>
              </div>

              <div className="relative mt-2">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="border-border/50 w-full border-t"></div>
                </div>
              </div>

              <div className="text-muted-foreground flex flex-col gap-1.5 text-xs">
                <span>
                  <strong>Tipo:</strong>{" "}
                  {formatEvaluationTypeLabel(
                    selectedEvaluation.evaluation_type,
                    selectedEvaluation.evaluation_number,
                    selectedEvaluation.custom_name,
                  )}
                </span>
                <span><strong>Período:</strong> {selectedEvaluation.term_display_name ? selectedEvaluation.term_display_name.replace(" - ", ": ") : "—"}</span>
                <span><strong>Profesor:</strong> {selectedEvaluation.professor_name ?? "—"}</span>
                <span><strong>Tamaño:</strong> {formatFileSize(selectedEvaluation.file_size)}</span>
                <span><strong>Cátedra:</strong> {selectedEvaluation.is_catedra ? "Sí" : "No"}</span>
                <span>
                  <strong>Respuestas:</strong>{" "}
                  {selectedEvaluation.has_separate_answers
                    ? "Archivo aparte"
                    : selectedEvaluation.includes_answers
                      ? "Incluidas"
                      : "No"}
                </span>
              </div>
            </div>

            <div className="bg-muted/30 mt-auto flex flex-col gap-3 border-t p-4 md:p-5">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor={`note-eval-${selectedEvaluation.id}`}
                  className="text-sm font-medium"
                >
                  Nota de moderación
                </Label>
                <Textarea
                  id={`note-eval-${selectedEvaluation.id}`}
                  value={moderationNote[selectedEvaluation.id] ?? ""}
                  onChange={(e) => onNoteChange(selectedEvaluation.id, e.target.value)}
                  className="bg-background h-20 min-h-0 resize-none text-sm shadow-none"
                  placeholder="Escribe una nota opcional para explicar el motivo del rechazo"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  className="w-full"
                  onClick={() => void onApprove(selectedEvaluation.id)}
                  disabled={isPending}
                >
                  <Check className="mr-2 size-4" /> Aprobar
                </Button>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => void onReject(selectedEvaluation.id)}
                  disabled={isPending}
                >
                  <X className="mr-2 size-4" /> Rechazar
                </Button>
              </div>
            </div>
          </div>

          <EvaluationPdfViewer selectedEvaluation={selectedEvaluation} />
        </div>
      )}
    </div>
  );
}

