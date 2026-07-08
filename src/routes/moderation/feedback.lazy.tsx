import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { useFeedbackList } from "@/lib/feedback/hooks";
import type { FeedbackRow } from "@/lib/feedback/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

export const Route = createLazyFileRoute("/moderation/feedback")({
  component: FeedbackModerationPage,
});

function FeedbackModerationPage() {
  const navigate = useNavigate();
  const search = Route.useSearch() as { page?: number; feedbackId?: number };
  const page = search.page ?? 1;
  const queryPage = Math.max(page - 1, 0);
  const selectedFeedbackId = search.feedbackId ?? null;

  const feedbackQuery = useFeedbackList(PAGE_SIZE, queryPage * PAGE_SIZE);

  const feedbackRows = useMemo(
    () => (feedbackQuery.data ?? []) as FeedbackRow[],
    [feedbackQuery.data],
  );
  const hasMore = feedbackRows.length === PAGE_SIZE; // Approximation, we don't have total count yet.

  // Auto-select first if none selected
  useEffect(() => {
    if (
      feedbackRows.length > 0 &&
      selectedFeedbackId === null &&
      !feedbackQuery.isFetching
    ) {
      const firstId = feedbackRows[0].id;
      void navigate({
        from: "/moderation/feedback",
        search: (prev: any) => ({ ...prev, feedbackId: firstId }),
        replace: true,
      });
    }
  }, [feedbackRows, selectedFeedbackId, navigate, feedbackQuery.isFetching]);

  const selectedFeedback = useMemo(
    () => feedbackRows.find((r) => r.id === selectedFeedbackId) ?? null,
    [feedbackRows, selectedFeedbackId],
  );

  const handlePageChange = (newPage: number) => {
    void navigate({
      from: "/moderation/feedback",
      search: { page: newPage },
    });
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "bug":
        return "Error";
      case "feature":
        return "Sugerencia";
      default:
        return "Otro";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "bug":
        return "text-red-600 dark:text-red-400";
      case "feature":
        return "text-blue-600 dark:text-blue-400";
      default:
        return "text-foreground";
    }
  };

  if (feedbackQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Loader2 className="text-muted-foreground size-8 animate-spin" />
      </div>
    );
  }

  if (feedbackRows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div>
          <p className="text-muted-foreground">No hay retroalimentación para mostrar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <div
        className={cn(
          "bg-card text-card-foreground shadow-xs flex min-h-0 shrink-0 w-full flex-col overflow-hidden rounded-xl border lg:w-72 xl:w-80",
          selectedFeedback ? "hidden lg:flex" : "flex",
        )}
      >
        <div className="flex items-center justify-between border-b p-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={queryPage === 0 || feedbackQuery.isFetching}
            onClick={() => handlePageChange(Math.max(1, page - 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium">
            Página {page.toString().padStart(2, "0")}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={!hasMore || feedbackQuery.isFetching}
            onClick={() => handlePageChange(page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
          <div className="flex flex-col gap-1">
            {feedbackRows.map((fb) => (
              <button
                key={fb.id}
                onClick={() => {
                  void navigate({
                    from: "/moderation/feedback",
                    search: (prev: any) => ({ ...prev, feedbackId: fb.id }),
                    replace: true,
                  });
                }}
                className={cn(
                  "flex w-full flex-col rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                  selectedFeedbackId === fb.id
                    ? "border-foreground/30 bg-accent"
                    : "hover:bg-muted border-transparent",
                )}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className={cn("truncate font-medium", getTypeColor(fb.type))}>{getTypeLabel(fb.type)}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {new Date(fb.created_at).toLocaleDateString()}
                  </span>
                </div>
                <span className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                  {fb.content}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Detail Pane */}
      {selectedFeedback && (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:max-h-full lg:overflow-y-auto">
          <div className="flex items-start justify-between gap-2 sm:hidden">
            <h2 className="text-sm font-semibold">Retroalimentación</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void navigate({
                  from: "/moderation/feedback",
                  search: (prev: any) => ({ ...prev, feedbackId: undefined }),
                  replace: true,
                });
              }}
            >
              Volver
            </Button>
          </div>

          <div className="bg-card text-card-foreground shadow-xs flex flex-col overflow-hidden rounded-xl border">
            <div className="flex flex-col gap-3 p-5 md:p-6">
              <div className="space-y-1">
                <h3 className={cn("text-xl font-semibold leading-none tracking-tight", getTypeColor(selectedFeedback.type))}>
                  {getTypeLabel(selectedFeedback.type)}
                </h3>
              </div>

              <div className="relative mt-2">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="border-border/50 w-full border-t"></div>
                </div>
              </div>

              <div className="text-muted-foreground flex flex-col gap-1.5 text-xs">
                <span>
                  <strong>Enviado el:</strong> {new Date(selectedFeedback.created_at).toLocaleString()}
                </span>
              </div>

              <div className="mt-2 space-y-1.5">
                <h4 className="text-sm font-medium">Contenido</h4>
                <div className="bg-muted/50 rounded-md border p-3 text-sm whitespace-pre-wrap leading-relaxed">
                  {selectedFeedback.content}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
