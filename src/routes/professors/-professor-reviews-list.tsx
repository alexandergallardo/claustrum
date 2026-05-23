import type { Dispatch, SetStateAction } from "react";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Flag, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import type { ProfessorReviewPublicRow } from "@/lib/professor-reviews/types";

import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import { useSetProfessorReviewReaction } from "@/lib/hooks/use-professor-reviews";

function formatDate(iso: string): string {
  const date = new Date(iso);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function scoreLabel(score: number | null): string {
  if (score === null) return "-";
  return score.toFixed(1);
}

function attendanceLabel(attendance: boolean | null): string {
  if (attendance === null) return "En revisión";
  return attendance ? "Obligatoria" : "No obligatoria";
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 8) return "text-green-600 dark:text-green-400";
  if (score >= 6) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

type ReactionValue = "like" | "dislike";

function ReviewActions({
  review,
  mobile = false,
  isPending,
  onReaction,
}: {
  review: ProfessorReviewPublicRow;
  mobile?: boolean;
  isPending: boolean;
  onReaction: (review: ProfessorReviewPublicRow, reaction: ReactionValue) => void;
}) {
  const isLiked = review.my_reaction === "like";
  const isDisliked = review.my_reaction === "dislike";

  return (
    <div
      className={
        mobile
          ? "flex items-center justify-end gap-2 pt-2"
          : "absolute right-4 bottom-5 flex items-center justify-end gap-2"
      }
    >
      <button
        type="button"
        aria-label={isLiked ? "Quitar me gusta" : "Me gusta"}
        aria-pressed={isLiked}
        disabled={isPending}
        onClick={() => onReaction(review, "like")}
        className={[
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-green-600 transition-colors hover:bg-green-100 disabled:pointer-events-none disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-950",
          isLiked ? "bg-green-100 dark:bg-green-950" : "",
        ].join(" ")}
      >
        <ThumbsUp className="size-4" />
        <span className="text-xs tabular-nums">{review.like_count}</span>
      </button>
      <button
        type="button"
        aria-label={isDisliked ? "Quitar no me gusta" : "No me gusta"}
        aria-pressed={isDisliked}
        disabled={isPending}
        onClick={() => onReaction(review, "dislike")}
        className={[
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-red-600 transition-colors hover:bg-red-100 disabled:pointer-events-none disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950",
          isDisliked ? "bg-red-100 dark:bg-red-950" : "",
        ].join(" ")}
      >
        <ThumbsDown className="size-4" />
        <span className="text-xs tabular-nums">{review.dislike_count}</span>
      </button>
      <div className="bg-border mx-1 h-4 w-px" />
      <button
        type="button"
        className="text-muted-foreground hover:bg-muted inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors"
      >
        <Flag className="size-3.5" />
        Reportar
      </button>
    </div>
  );
}

const columnHelper = createColumnHelper<ProfessorReviewPublicRow>();

function getColumns(
  onReaction: (review: ProfessorReviewPublicRow, reaction: ReactionValue) => void,
  isReactionPending: boolean,
) {
  return [
    columnHelper.display({
      id: "scores",
      header: "Calificación",
      cell: ({ row }) => (
        <div className="pb-5">
          <div className="flex h-10 items-center px-4">
            <p className="text-muted-foreground text-sm">{formatDate(row.original.created_at)}</p>
          </div>
          <Separator className="w-full" />
          <div className="space-y-2 px-4 pt-3">
            <div className="flex items-center gap-2">
              <span
                className={
                  "bg-muted inline-flex size-8 items-center justify-center rounded-md text-sm font-medium tabular-nums " +
                  scoreColor(row.original.ease_score)
                }
              >
                {scoreLabel(row.original.ease_score)}
              </span>
              <span className="text-muted-foreground text-sm">Facilidad</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={
                  "bg-muted inline-flex size-8 items-center justify-center rounded-md text-sm font-medium tabular-nums " +
                  scoreColor(row.original.quality_score)
                }
              >
                {scoreLabel(row.original.quality_score)}
              </span>
              <span className="text-muted-foreground text-sm">Calidad</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={
                  "bg-muted inline-flex size-8 items-center justify-center rounded-md text-sm font-medium tabular-nums " +
                  scoreColor(row.original.clarity_score)
                }
              >
                {scoreLabel(row.original.clarity_score)}
              </span>
              <span className="text-muted-foreground text-sm">Claridad</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={
                  "bg-muted inline-flex size-8 items-center justify-center rounded-md text-sm font-medium tabular-nums " +
                  scoreColor(row.original.fairness_score)
                }
              >
                {scoreLabel(row.original.fairness_score)}
              </span>
              <span className="text-muted-foreground text-sm">Justicia</span>
            </div>
          </div>
        </div>
      ),
    }),
    columnHelper.display({
      id: "course",
      header: "Curso",
      cell: ({ row }) => (
        <div className="px-4">
          <p className="font-semibold break-words">
            {row.original.course_code}: {row.original.course_name}
          </p>
          <div className="h-3" />
          <p className="text-sm">
            <span className="font-semibold">Asistencia:</span>{" "}
            <span className="text-muted-foreground">
              {attendanceLabel(row.original.attendance_required)}
            </span>
          </p>
          <div className="h-3" />
          <p className="text-sm">
            <span className="font-semibold">Calificación recibida:</span>{" "}
            <span className="text-muted-foreground">
              {row.original.grade_received ?? "En revisión"}
            </span>
          </p>
          <p className="text-sm">
            <span className="font-semibold">Interés en la clase:</span>{" "}
            <span className="text-muted-foreground">
              {row.original.engagement_level ?? "En revisión"}
            </span>
          </p>
        </div>
      ),
    }),
    columnHelper.display({
      id: "tags-comment",
      header: "Comentario",
      cell: ({ row }) => (
        <div className="h-full px-4 pb-12">
          <div className="space-y-2">
            {row.original.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {row.original.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            <p>{row.original.comment}</p>
          </div>
          <ReviewActions
            review={row.original}
            isPending={isReactionPending}
            onReaction={onReaction}
          />
        </div>
      ),
    }),
  ];
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
}: ProfessorReviewsListProps) {
  const reactionMutation = useSetProfessorReviewReaction();

  function handleReaction(review: ProfessorReviewPublicRow, reaction: ReactionValue) {
    reactionMutation.mutate(
      {
        reviewId: review.review_id,
        reaction: review.my_reaction === reaction ? null : reaction,
      },
      {
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "No se pudo guardar tu reacción");
        },
      },
    );
  }

  const table = useReactTable({
    data: reviewRows,
    columns: getColumns(handleReaction, reactionMutation.isPending),
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
    state: {
      pagination: {
        pageIndex: page,
        pageSize,
      },
    },
  });

  return (
    <div className="space-y-4">
      {isLoading && reviewRows.length === 0 ? (
        <div className="text-muted-foreground text-sm">Cargando reseñas…</div>
      ) : reviewRows.length === 0 ? (
        <div className="text-muted-foreground text-sm">Aún no hay reseñas para este profesor.</div>
      ) : (
        <>
          <div className="bg-card rounded-xl border md:hidden">
            <div className="divide-y">
              {reviewRows.map((review) => (
                <article key={review.review_id}>
                  <section className="bg-muted/30">
                    <div className="flex h-14 items-center px-4">
                      <p className="text-muted-foreground text-sm leading-none">
                        {formatDate(review.created_at)}
                      </p>
                    </div>
                    <div className="border-border border-t" />
                    <div className="space-y-2 px-4 pt-3 pb-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            "bg-muted inline-flex size-8 items-center justify-center rounded-md text-sm font-medium tabular-nums " +
                            scoreColor(review.ease_score)
                          }
                        >
                          {scoreLabel(review.ease_score)}
                        </span>
                        <span className="text-muted-foreground text-sm">Facilidad</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            "bg-muted inline-flex size-8 items-center justify-center rounded-md text-sm font-medium tabular-nums " +
                            scoreColor(review.quality_score)
                          }
                        >
                          {scoreLabel(review.quality_score)}
                        </span>
                        <span className="text-muted-foreground text-sm">Calidad</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            "bg-muted inline-flex size-8 items-center justify-center rounded-md text-sm font-medium tabular-nums " +
                            scoreColor(review.clarity_score)
                          }
                        >
                          {scoreLabel(review.clarity_score)}
                        </span>
                        <span className="text-muted-foreground text-sm">Claridad</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            "bg-muted inline-flex size-8 items-center justify-center rounded-md text-sm font-medium tabular-nums " +
                            scoreColor(review.fairness_score)
                          }
                        >
                          {scoreLabel(review.fairness_score)}
                        </span>
                        <span className="text-muted-foreground text-sm">Justicia</span>
                      </div>
                    </div>
                  </section>

                  <div className="border-border border-t" />

                  <section className="p-4">
                    <p className="font-semibold break-words">
                      {review.course_code}: {review.course_name}
                    </p>
                    <div className="h-3" />
                    <p className="text-sm">
                      <span className="font-semibold">Asistencia:</span>{" "}
                      <span className="text-muted-foreground">
                        {attendanceLabel(review.attendance_required)}
                      </span>
                    </p>
                    <div className="h-3" />
                    <p className="text-sm">
                      <span className="font-semibold">Calificación recibida:</span>{" "}
                      <span className="text-muted-foreground">
                        {review.grade_received ?? "En revisión"}
                      </span>
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold">Interés en la clase:</span>{" "}
                      <span className="text-muted-foreground">
                        {review.engagement_level ?? "En revisión"}
                      </span>
                    </p>
                  </section>

                  <div className="border-border border-t" />

                  <section className="p-4">
                    <div className="space-y-2">
                      {review.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {review.tags.map((tag) => (
                            <Badge key={`${review.review_id}-${tag}`} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                      <p>{review.comment}</p>
                    </div>
                    <ReviewActions
                      review={review}
                      mobile
                      isPending={reactionMutation.isPending}
                      onReaction={handleReaction}
                    />
                  </section>
                </article>
              ))}
            </div>
          </div>

          <div className="bg-card hidden rounded-xl border md:block">
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="text-muted-foreground border-b px-4 py-3 text-left text-sm font-semibold uppercase"
                        style={
                          header.column.id === "scores"
                            ? { width: "20%" }
                            : header.column.id === "course"
                              ? { width: "30%" }
                              : { width: "50%" }
                        }
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={index !== table.getRowModel().rows.length - 1 ? "border-b" : ""}
                  >
                    {row.getVisibleCells().map((cell, cellIndex) => (
                      <td
                        key={cell.id}
                        className={[
                          cell.column.id === "scores"
                            ? "bg-muted/30 pt-0 align-top"
                            : "py-5 align-top",
                          cell.column.id === "tags-comment" ? "relative" : "",
                          cellIndex !== row.getVisibleCells().length - 1 ? "border-r" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showPagination && (
        <div className="flex items-center justify-between gap-4 px-4">
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
                <SelectTrigger className="h-8 w-full">
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
    </div>
  );
}
