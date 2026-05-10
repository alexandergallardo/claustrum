import type { Dispatch, SetStateAction } from "react";

import type { ProfessorReviewPublicRow } from "@/lib/professor-reviews/types";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function scoreLabel(score: number | null) {
  if (score === null) return "En revisión";
  return score.toFixed(1);
}

type ProfessorReviewsListProps = {
  reviewRows: ProfessorReviewPublicRow[];
  isLoading: boolean;
  isFetching: boolean;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
  firstRow: number;
  lastRow: number;
  onPageChange: Dispatch<SetStateAction<number>>;
  onPageSizeChange: Dispatch<SetStateAction<number>>;
  showPagination?: boolean;
  showTitle?: boolean;
  frameless?: boolean;
};

export function ProfessorReviewsList({
  reviewRows,
  isLoading,
  isFetching,
  page,
  pageSize,
  totalCount,
  totalPages,
  hasMore,
  firstRow,
  lastRow,
  onPageChange,
  onPageSizeChange,
  showPagination = true,
  showTitle = true,
  frameless = false,
}: ProfessorReviewsListProps) {
  const content = (
    <>
      {showTitle && <CardTitle className="text-base">Reseñas</CardTitle>}
      {isLoading && reviewRows.length === 0 ? (
        <div className="text-muted-foreground text-sm">Cargando reseñas…</div>
      ) : reviewRows.length === 0 ? (
        <div className="text-muted-foreground text-sm">Aún no hay reseñas para este profesor.</div>
      ) : (
        <div className="divide-y rounded-md border">
          {reviewRows.map((review) => (
            <article key={review.review_id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">
                  {review.course_code} - {review.course_name}
                </div>
                <Badge variant={review.status === "approved" ? "default" : "outline"}>
                  {review.status === "approved" ? "Aprobada" : "En revisión"}
                </Badge>
              </div>

              <div className="text-muted-foreground grid gap-2 text-xs md:grid-cols-3">
                <div>
                  Asistencia:{" "}
                  {review.attendance_required === null
                    ? "En revisión"
                    : review.attendance_required
                      ? "Obligatoria"
                      : "No obligatoria"}
                </div>
                <div>Calificación: {review.grade_received ?? "En revisión"}</div>
                <div>Interés: {review.engagement_level ?? "En revisión"}</div>
              </div>

              <div className="text-muted-foreground grid gap-2 text-xs md:grid-cols-4">
                <div>Facilidad: {scoreLabel(review.ease_score)}</div>
                <div>Calidad: {scoreLabel(review.quality_score)}</div>
                <div>Claridad: {scoreLabel(review.clarity_score)}</div>
                <div>Justicia: {scoreLabel(review.fairness_score)}</div>
              </div>

              {review.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {review.tags.map((tag) => (
                    <Badge key={`${review.review_id}-${tag}`} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <p className="text-sm">{review.comment}</p>
            </article>
          ))}
        </div>
      )}

      {showPagination && (
        <div className="mt-2 flex items-center justify-between gap-4">
          <span className="text-muted-foreground text-xs">
            {reviewRows.length === 0
              ? "Sin resultados"
              : `Mostrando ${firstRow}-${lastRow} de ${totalCount}`}{" "}
            · Página {page + 1} de {totalPages}
          </span>
          <div className="flex items-center gap-3">
            <Pagination className="w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      onPageChange((value) => Math.max(value - 1, 0));
                    }}
                    aria-disabled={page === 0 || isFetching}
                    className={page === 0 || isFetching ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      onPageChange((value) => value + 1);
                    }}
                    aria-disabled={!hasMore || isFetching}
                    className={!hasMore || isFetching ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
            <div className="w-28">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  onPageChange(0);
                  onPageSizeChange(Number(value));
                }}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Filas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 filas</SelectItem>
                  <SelectItem value="25">25 filas</SelectItem>
                  <SelectItem value="50">50 filas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (frameless) {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">{content}</CardContent>
    </Card>
  );
}
