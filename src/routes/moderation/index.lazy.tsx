import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { EvaluationModerationRow } from "@/lib/evaluations/types";
import type { ProfessorReviewModerationRow } from "@/lib/professor-reviews/types";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { formatEvaluationTypeLabel } from "@/lib/evaluations/types";
import { useEvaluationModerationQueue, useModerateEvaluation } from "@/lib/hooks/use-evaluations";
import { useModerationCounts } from "@/lib/hooks/use-moderation";
import {
  useIsAdmin,
  useModerateProfessorReview,
  useModerationQueue,
} from "@/lib/hooks/use-professor-reviews";
import { useAuthUser } from "@/lib/hooks/use-queries";
import { cn } from "@/lib/utils";

type Tab = "reviews" | "evaluations";

const PAGE_SIZE = 20;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AdminModerationPage() {
  const navigate = useNavigate();
  const { data: authUser, isLoading: isAuthLoading } = useAuthUser();
  const isAdminQuery = useIsAdmin(authUser?.id ?? null);

  const canModerate = !!authUser && isAdminQuery.data === true;

  useEffect(() => {
    if (isAuthLoading || isAdminQuery.isLoading) return;
    if (!authUser) {
      void navigate({ to: "/auth/signin", replace: true });
      return;
    }
    if (!canModerate) {
      void navigate({ to: "/overview", replace: true });
    }
  }, [authUser, canModerate, isAuthLoading, isAdminQuery.isLoading, navigate]);

  const [tab, setTab] = useState<Tab>("reviews");
  const [reviewPage, setReviewPage] = useState(0);
  const [evaluationPage, setEvaluationPage] = useState(0);
  const [moderationNote, setModerationNote] = useState<Record<number, string>>({});
  const [selectedReviewId, setSelectedReviewId] = useState<number | null>(null);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<number | null>(null);

  const countsQuery = useModerationCounts(canModerate);
  const reviewsQuery = useModerationQueue("pending", reviewPage, PAGE_SIZE, canModerate);
  const evaluationsQuery = useEvaluationModerationQueue(
    "pending",
    evaluationPage,
    PAGE_SIZE,
    canModerate,
  );
  const moderateReviewMutation = useModerateProfessorReview();
  const moderateEvaluationMutation = useModerateEvaluation();

  const reviewRows = useMemo(
    () => (reviewsQuery.data ?? []) as ProfessorReviewModerationRow[],
    [reviewsQuery.data],
  );
  const evaluationRows = useMemo(
    () => (evaluationsQuery.data ?? []) as EvaluationModerationRow[],
    [evaluationsQuery.data],
  );
  const reviewTotal = reviewRows[0]?.total_count ?? 0;
  const evaluationTotal = evaluationRows[0]?.total_count ?? 0;
  const reviewHasMore = reviewTotal > (reviewPage + 1) * PAGE_SIZE;
  const evaluationHasMore = evaluationTotal > (evaluationPage + 1) * PAGE_SIZE;

  const selectedReview = useMemo(
    () => reviewRows.find((r) => r.review_id === selectedReviewId) ?? null,
    [reviewRows, selectedReviewId],
  );
  const selectedEvaluation = useMemo(
    () => evaluationRows.find((e) => e.id === selectedEvaluationId) ?? null,
    [evaluationRows, selectedEvaluationId],
  );

  const handleApproveReview = async (reviewId: number) => {
    try {
      await moderateReviewMutation.mutateAsync({
        reviewId,
        status: "approved",
        note: moderationNote[reviewId] ?? "",
      });
      toast.success("Reseña aprobada");
      if (selectedReviewId === reviewId) setSelectedReviewId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo moderar la reseña.");
    }
  };

  const handleRejectReview = async (reviewId: number) => {
    try {
      await moderateReviewMutation.mutateAsync({
        reviewId,
        status: "rejected",
        note: moderationNote[reviewId] ?? "",
      });
      toast.success("Reseña rechazada");
      if (selectedReviewId === reviewId) setSelectedReviewId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo moderar la reseña.");
    }
  };

  const handleApproveEvaluation = async (evaluationId: number) => {
    try {
      await moderateEvaluationMutation.mutateAsync({
        evaluationId,
        status: "approved",
        note: moderationNote[evaluationId] ?? "",
      });
      toast.success("Evaluación aprobada");
      if (selectedEvaluationId === evaluationId) setSelectedEvaluationId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo moderar la evaluación.");
    }
  };

  const handleRejectEvaluation = async (evaluationId: number) => {
    try {
      await moderateEvaluationMutation.mutateAsync({
        evaluationId,
        status: "rejected",
        note: moderationNote[evaluationId] ?? "",
      });
      toast.success("Evaluación rechazada");
      if (selectedEvaluationId === evaluationId) setSelectedEvaluationId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo moderar la evaluación.");
    }
  };

  if (isAuthLoading || isAdminQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-muted-foreground text-sm">Verificando permisos…</p>
      </div>
    );
  }

  if (!authUser || !canModerate) {
    return null;
  }

  const reviewPending = countsQuery.data?.pendingReviews ?? reviewTotal;
  const evaluationPending = countsQuery.data?.pendingEvaluations ?? evaluationTotal;

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex items-center gap-1 rounded-lg border p-1 text-sm">
        <TabButton
          active={tab === "reviews"}
          onClick={() => {
            setTab("reviews");
            setSelectedReviewId(null);
            setSelectedEvaluationId(null);
          }}
        >
          Reseñas
          {reviewPending > 0 && (
            <span className="bg-foreground text-background ml-1.5 inline-flex size-5 items-center justify-center rounded-full text-[10px] font-semibold">
              {reviewPending > 99 ? "99+" : reviewPending}
            </span>
          )}
        </TabButton>
        <TabButton
          active={tab === "evaluations"}
          onClick={() => {
            setTab("evaluations");
            setSelectedEvaluationId(null);
            setSelectedReviewId(null);
          }}
        >
          Evaluaciones
          {evaluationPending > 0 && (
            <span className="bg-foreground text-background ml-1.5 inline-flex size-5 items-center justify-center rounded-full text-[10px] font-semibold">
              {evaluationPending > 99 ? "99+" : evaluationPending}
            </span>
          )}
        </TabButton>
      </div>

      {tab === "reviews" && (
        <ReviewSection
          rows={reviewRows}
          selectedReview={selectedReview}
          onSelect={setSelectedReviewId}
          page={reviewPage}
          hasMore={reviewHasMore}
          isLoading={reviewsQuery.isLoading}
          isFetching={reviewsQuery.isFetching}
          onPageChange={setReviewPage}
          moderationNote={moderationNote}
          onNoteChange={(id, value) => setModerationNote((prev) => ({ ...prev, [id]: value }))}
          onApprove={handleApproveReview}
          onReject={handleRejectReview}
          isPending={moderateReviewMutation.isPending}
        />
      )}

      {tab === "evaluations" && (
        <EvaluationSection
          rows={evaluationRows}
          selectedEvaluation={selectedEvaluation}
          onSelect={setSelectedEvaluationId}
          page={evaluationPage}
          hasMore={evaluationHasMore}
          isLoading={evaluationsQuery.isLoading}
          isFetching={evaluationsQuery.isFetching}
          onPageChange={setEvaluationPage}
          moderationNote={moderationNote}
          onNoteChange={(id, value) => setModerationNote((prev) => ({ ...prev, [id]: value }))}
          onApprove={handleApproveEvaluation}
          onReject={handleRejectEvaluation}
          isPending={moderateEvaluationMutation.isPending}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-1 items-center justify-center px-3 py-2 text-sm font-medium transition-colors sm:flex-initial"
    >
      {children}
      {active && (
        <span className="bg-foreground absolute right-2 bottom-0 left-2 h-0.5 rounded-full" />
      )}
    </button>
  );
}

function ReviewSection({
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
        className={cn("flex w-full flex-col lg:w-72 xl:w-80", selectedReview && "hidden lg:flex")}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          {isLoading ? (
            <p className="text-muted-foreground px-1 text-sm">Cargando reseñas…</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground px-1 text-sm">No hay reseñas pendientes.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {rows.map((review) => (
                <button
                  key={review.review_id}
                  type="button"
                  onClick={() => onSelect(review.review_id)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    selectedReview?.review_id === review.review_id
                      ? "border-foreground/30 bg-accent"
                      : "hover:bg-muted border-transparent",
                  )}
                >
                  <span className="truncate font-medium">{review.professor_name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {review.course_code} - {review.course_name}
                  </span>
                  <span className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                    {review.comment}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {rows.length > 0 && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Pág. {page + 1}</span>
            <Pagination className="w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onPageChange(Math.max(page - 1, 0));
                    }}
                    aria-disabled={page === 0 || isFetching}
                    className={page === 0 || isFetching ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onPageChange(page + 1);
                    }}
                    aria-disabled={!hasMore || isFetching}
                    className={!hasMore || isFetching ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {selectedReview && (
        <div className="flex flex-1 flex-col gap-4 lg:max-h-full lg:overflow-y-auto">
          <div className="flex items-start justify-between gap-2 sm:hidden">
            <h2 className="text-sm font-semibold">Revisión</h2>
            <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
              Volver
            </Button>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <div>
              <p className="font-medium">{selectedReview.professor_name}</p>
              <p className="text-muted-foreground text-sm">
                {selectedReview.course_code} - {selectedReview.course_name}
              </p>
            </div>

            <Separator />

            <p className="text-sm">{selectedReview.comment}</p>

            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span>Facilidad: {selectedReview.ease_score.toFixed(1)}</span>
              <span>Calidad: {selectedReview.quality_score.toFixed(1)}</span>
              <span>Claridad: {selectedReview.clarity_score.toFixed(1)}</span>
              <span>Justicia: {selectedReview.fairness_score.toFixed(1)}</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`note-review-${selectedReview.review_id}`}>Nota de moderación</Label>
              <Textarea
                id={`note-review-${selectedReview.review_id}`}
                value={moderationNote[selectedReview.review_id] ?? ""}
                onChange={(e) => onNoteChange(selectedReview.review_id, e.target.value)}
                className="h-20 min-h-0 text-xs"
                placeholder="Opcional — ej. motivo del rechazo"
              />
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => void onApprove(selectedReview.review_id)}
                disabled={isPending}
              >
                Aprobar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => void onReject(selectedReview.review_id)}
                disabled={isPending}
              >
                Rechazar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EvaluationSection({
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
          "flex w-full flex-col lg:w-72 xl:w-80",
          selectedEvaluation && "hidden lg:flex",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          {isLoading ? (
            <p className="text-muted-foreground px-1 text-sm">Cargando evaluaciones…</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground px-1 text-sm">No hay evaluaciones pendientes.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {rows.map((evaluation) => (
                <button
                  key={evaluation.id}
                  type="button"
                  onClick={() => onSelect(evaluation.id)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    selectedEvaluation?.id === evaluation.id
                      ? "border-foreground/30 bg-accent"
                      : "hover:bg-muted border-transparent",
                  )}
                >
                  <span className="truncate font-medium">{evaluation.course_code}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {formatEvaluationTypeLabel(
                      evaluation.evaluation_type,
                      evaluation.evaluation_number,
                      evaluation.custom_name,
                    )}
                    {evaluation.professor_name && ` — ${evaluation.professor_name}`}
                  </span>
                  <span className="text-muted-foreground mt-0.5 text-xs">
                    {formatFileSize(evaluation.file_size)}
                    {evaluation.term_display_name && ` · ${evaluation.term_display_name}`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {rows.length > 0 && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Pág. {page + 1}</span>
            <Pagination className="w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onPageChange(Math.max(page - 1, 0));
                    }}
                    aria-disabled={page === 0 || isFetching}
                    className={page === 0 || isFetching ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onPageChange(page + 1);
                    }}
                    aria-disabled={!hasMore || isFetching}
                    className={!hasMore || isFetching ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {selectedEvaluation && (
        <div className="flex flex-1 flex-col gap-4 lg:max-h-full lg:overflow-y-auto">
          <div className="flex items-start justify-between gap-2 sm:hidden">
            <h2 className="text-sm font-semibold">Revisión</h2>
            <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
              Volver
            </Button>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <div>
              <p className="font-medium">{selectedEvaluation.course_code}</p>
              <p className="text-muted-foreground text-sm">{selectedEvaluation.course_name}</p>
            </div>

            <Separator />

            <div className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
              <span>
                Tipo:{" "}
                {formatEvaluationTypeLabel(
                  selectedEvaluation.evaluation_type,
                  selectedEvaluation.evaluation_number,
                  selectedEvaluation.custom_name,
                )}
              </span>
              <span>Período: {selectedEvaluation.term_display_name ?? "—"}</span>
              <span>Profesor: {selectedEvaluation.professor_name ?? "—"}</span>
              <span>Tamaño: {formatFileSize(selectedEvaluation.file_size)}</span>
              <span>Cátedra: {selectedEvaluation.is_catedra ? "Sí" : "No"}</span>
              <span>
                Respuestas:{" "}
                {selectedEvaluation.has_separate_answers
                  ? "Archivo aparte"
                  : selectedEvaluation.includes_answers
                    ? "Incluidas"
                    : "No"}
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`note-eval-${selectedEvaluation.id}`}>Nota de moderación</Label>
              <Textarea
                id={`note-eval-${selectedEvaluation.id}`}
                value={moderationNote[selectedEvaluation.id] ?? ""}
                onChange={(e) => onNoteChange(selectedEvaluation.id, e.target.value)}
                className="h-20 min-h-0 text-xs"
                placeholder="Opcional — ej. motivo del rechazo"
              />
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => void onApprove(selectedEvaluation.id)}
                disabled={isPending}
              >
                Aprobar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => void onReject(selectedEvaluation.id)}
                disabled={isPending}
              >
                Rechazar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const Route = createLazyFileRoute("/moderation/")({
  component: AdminModerationPage,
});
