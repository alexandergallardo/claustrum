import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Textarea } from "@/components/ui/textarea";
import {
  useIsAdmin,
  useModerateProfessorReview,
  useModerationQueue,
} from "@/lib/hooks/use-professor-reviews";
import { useAuthUser } from "@/lib/hooks/use-queries";

const PAGE_SIZE = 20;

export function ModerationPage() {
  const navigate = useNavigate({ from: "/professors/moderation" });
  const { data: authUser, isLoading: isAuthLoading } = useAuthUser();
  const [page, setPage] = useState(0);
  const [moderationNote, setModerationNote] = useState<Record<number, string>>({});
  const isAdminQuery = useIsAdmin();
  const queueQuery = useModerationQueue("pending", page, PAGE_SIZE);
  const moderateMutation = useModerateProfessorReview();

  const rows = queueQuery.data ?? [];
  const totalCount = rows[0]?.total_count ?? 0;
  const hasMore = totalCount > (page + 1) * PAGE_SIZE;

  const canModerate = useMemo(() => isAdminQuery.data === true, [isAdminQuery.data]);

  useEffect(() => {
    if (isAuthLoading || isAdminQuery.isLoading) return;
    if (!authUser || !canModerate) {
      void navigate({ to: "/professors" });
    }
  }, [authUser, canModerate, isAdminQuery.isLoading, isAuthLoading, navigate]);

  if (isAuthLoading || isAdminQuery.isLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Cargando moderación...</div>
    );
  }

  if (!authUser || !canModerate) {
    return null;
  }

  const handleModeration = async (reviewId: number, status: "approved" | "rejected") => {
    try {
      await moderateMutation.mutateAsync({
        reviewId,
        status,
        note: moderationNote[reviewId] ?? "",
      });
      toast.success(status === "approved" ? "Reseña aprobada" : "Reseña rechazada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo moderar la reseña.");
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">Moderación de reseñas</h1>
          <Badge variant="outline">{totalCount} pendientes</Badge>
        </div>

        <Card>
          <CardContent className="space-y-4 p-4">
            {queueQuery.isLoading ? (
              <div className="text-sm text-muted-foreground">Cargando cola de moderación...</div>
            ) : rows.length === 0 ? (
              <div className="text-sm text-muted-foreground">No hay reseñas pendientes por moderar.</div>
            ) : (
              rows.map((review) => (
                <div key={review.review_id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-medium">{review.professor_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {review.course_code} - {review.course_name}
                      </div>
                    </div>
                    <Badge variant="outline">Pendiente</Badge>
                  </div>

                  <p className="text-sm">{review.comment}</p>

                  <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
                    <div>Facilidad: {review.ease_score.toFixed(1)}</div>
                    <div>Calidad: {review.quality_score.toFixed(1)}</div>
                    <div>Claridad: {review.clarity_score.toFixed(1)}</div>
                    <div>Justicia: {review.fairness_score.toFixed(1)}</div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`note-${review.review_id}`}>Nota de moderación (opcional)</Label>
                    <Textarea
                      id={`note-${review.review_id}`}
                      value={moderationNote[review.review_id] ?? ""}
                      onChange={(event) =>
                        setModerationNote((previous) => ({
                          ...previous,
                          [review.review_id]: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => void handleModeration(review.review_id, "approved")}
                      disabled={moderateMutation.isPending}
                    >
                      Aprobar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => void handleModeration(review.review_id, "rejected")}
                      disabled={moderateMutation.isPending}
                    >
                      Rechazar
                    </Button>
                  </div>
                </div>
              ))
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Pagina {page + 1}</span>
              <Pagination className="w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        setPage((value) => Math.max(value - 1, 0));
                      }}
                      aria-disabled={page === 0 || queueQuery.isLoading}
                      className={page === 0 || queueQuery.isLoading ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        setPage((value) => value + 1);
                      }}
                      aria-disabled={!hasMore || queueQuery.isLoading}
                      className={!hasMore || queueQuery.isLoading ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </CardContent>
        </Card>
      </div>
  );
}
