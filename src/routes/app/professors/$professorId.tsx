import { lazy, Suspense, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ArrowLeft, PenLine } from "lucide-react";
import { toast } from "sonner";

import { AppLayoutWrapper } from "@/components/app-layout-wrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getTurnstileSiteKey } from "@/lib/env/public";
import {
  useProfessorById,
  useProfessorReviewsPublic,
  useProfessorReviewSummary,
  useSubmitProfessorReview,
} from "@/lib/hooks/use-professor-reviews";
import { REVIEW_TAG_OPTIONS, type ReviewTag } from "@/lib/professor-reviews/types";
import { useIsMobile } from "@/hooks/use-mobile";

const ReviewComposer = lazy(() =>
  import("./-review-composer").then((module) => ({ default: module.ReviewComposer })),
);

const ProfessorReviewsList = lazy(() =>
  import("./-professor-reviews-list").then((module) => ({ default: module.ProfessorReviewsList })),
);

const reviewFormSchema = z.object({
  courseCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,4}\d{3,4}$/),
  comment: z.string().trim().min(5).max(1000),
  easeScore: z.number().min(0).max(10),
  qualityScore: z.number().min(0).max(10),
  clarityScore: z.number().min(0).max(10),
  fairnessScore: z.number().min(0).max(10),
  attendanceRequired: z.boolean(),
  gradeReceived: z.string().trim().max(32).optional(),
  engagementLevel: z.number().int().min(1).max(5),
  tags: z.array(z.enum(REVIEW_TAG_OPTIONS)).max(6),
  turnstileToken: z.string().min(1),
});

export const Route = createFileRoute("/app/professors/$professorId")({
  component: ProfessorDetailPage,
});

const DEFAULT_PAGE_SIZE = 10;

function metricLabel(value: number | null, suffix = "") {
  if (value === null) return "-";
  return `${value.toFixed(2)}${suffix}`;
}

function ProfessorDetailPage() {
  const navigate = Route.useNavigate();
  const params = Route.useParams();
  const isMobile = useIsMobile();
  const professorId = Number(params.professorId);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const [courseCode, setCourseCode] = useState("");
  const [comment, setComment] = useState("");
  const [easeScore, setEaseScore] = useState("8.0");
  const [qualityScore, setQualityScore] = useState("8.0");
  const [clarityScore, setClarityScore] = useState("8.0");
  const [fairnessScore, setFairnessScore] = useState("8.0");
  const [attendanceRequired, setAttendanceRequired] = useState(true);
  const [gradeReceived, setGradeReceived] = useState("");
  const [engagementLevel, setEngagementLevel] = useState("4");
  const [tags, setTags] = useState<ReviewTag[]>([]);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const turnstileSiteKey = getTurnstileSiteKey();
  const parsedProfessorId = Number.isFinite(professorId) && professorId > 0 ? professorId : null;

  const professorQuery = useProfessorById(parsedProfessorId);
  const summaryQuery = useProfessorReviewSummary(parsedProfessorId);
  const reviewsQuery = useProfessorReviewsPublic(parsedProfessorId, page, pageSize);
  const submitMutation = useSubmitProfessorReview();

  const reviewRows = reviewsQuery.data ?? [];
  const totalCount = reviewRows[0]?.total_count ?? 0;
  const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / pageSize);
  const hasMore = page + 1 < totalPages;
  const firstRow = reviewRows.length === 0 ? 0 : page * pageSize + 1;
  const lastRow = page * pageSize + reviewRows.length;

  const summary = summaryQuery.data;
  const isInvalidProfessorId = parsedProfessorId === null;

  const resetComposer = () => {
    setCourseCode("");
    setComment("");
    setEaseScore("8.0");
    setQualityScore("8.0");
    setClarityScore("8.0");
    setFairnessScore("8.0");
    setAttendanceRequired(true);
    setGradeReceived("");
    setEngagementLevel("4");
    setTags([]);
    setTurnstileToken(null);
  };

  const handleTagToggle = (tag: ReviewTag, checked: boolean) => {
    setTags((previous) => {
      if (checked) return Array.from(new Set([...previous, tag]));
      return previous.filter((value) => value !== tag);
    });
  };

  const handleSubmit = async () => {
    if (parsedProfessorId === null) return;

    const parsed = reviewFormSchema.safeParse({
      courseCode,
      comment,
      easeScore: Number(easeScore),
      qualityScore: Number(qualityScore),
      clarityScore: Number(clarityScore),
      fairnessScore: Number(fairnessScore),
      attendanceRequired,
      gradeReceived,
      engagementLevel: Number(engagementLevel),
      tags,
      turnstileToken: turnstileToken ?? "",
    });

    if (!parsed.success) {
      toast.error("Revisa los datos del formulario y vuelve a intentar.");
      return;
    }

    try {
      await submitMutation.mutateAsync({
        professorId: parsedProfessorId,
        ...parsed.data,
      });
      toast.success("Reseña enviada. Quedará visible cuando sea aprobada por administración.");
      setIsComposerOpen(false);
      resetComposer();
      await reviewsQuery.refetch();
      await summaryQuery.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar la reseña.");
    }
  };

  if (isInvalidProfessorId) {
    return (
      <AppLayoutWrapper>
        <div className="p-6 text-sm text-muted-foreground">ID de profesor inválido.</div>
      </AppLayoutWrapper>
    );
  }

  return (
    <AppLayoutWrapper>
      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => void navigate({ to: "/app/professors" })}
              aria-label="Atrás"
              title="Atrás"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">{professorQuery.data?.full_name ?? "Profesor"}</h1>
          </div>
          <Button type="button" onClick={() => setIsComposerOpen(true)}>
            <PenLine className="mr-2 h-4 w-4" />
            Escribir reseña
          </Button>
        </div>

        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <MetricPill label="Promedio general" value={metricLabel(summary?.average_overall_score ?? null)} />
              <MetricPill label="Facilidad" value={metricLabel(summary?.average_ease_score ?? null)} />
              <MetricPill label="Calidad" value={metricLabel(summary?.average_quality_score ?? null)} />
              <MetricPill
                label="La llevarían otra vez"
                value={summary?.would_take_again_percentage === null ? "-" : `${summary?.would_take_again_percentage.toFixed(1)}%`}
              />
            </div>
            <div className="border-t pt-3">
              <p className="mb-2 text-sm font-medium">Etiquetas destacadas</p>
              {summaryQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Cargando etiquetas...</p>
              ) : summary?.tag_counts?.length ? (
                <div className="flex flex-wrap gap-2">
                  {summary.tag_counts.slice(0, 10).map((tag) => (
                    <Badge key={tag.tag} variant="secondary">
                      {tag.tag} ({tag.count})
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aún no hay etiquetas aprobadas para mostrar.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Suspense fallback={<div className="h-[260px] w-full rounded-lg border bg-muted/20" />}>
          <ProfessorReviewsList
            reviewRows={reviewRows}
            isLoading={reviewsQuery.isLoading}
            isFetching={reviewsQuery.isFetching}
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            totalPages={totalPages}
            hasMore={hasMore}
            firstRow={firstRow}
            lastRow={lastRow}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </Suspense>

        {isComposerOpen ? (
          <Suspense fallback={null}>
            <ReviewComposer
              isMobile={isMobile}
              open={isComposerOpen}
              onOpenChange={(open) => {
                setIsComposerOpen(open);
                if (!open) setTurnstileToken(null);
              }}
              submitMutationPending={submitMutation.isPending}
              turnstileSiteKey={turnstileSiteKey}
              courseCode={courseCode}
              setCourseCode={setCourseCode}
              gradeReceived={gradeReceived}
              setGradeReceived={setGradeReceived}
              comment={comment}
              setComment={setComment}
              easeScore={easeScore}
              setEaseScore={setEaseScore}
              qualityScore={qualityScore}
              setQualityScore={setQualityScore}
              clarityScore={clarityScore}
              setClarityScore={setClarityScore}
              fairnessScore={fairnessScore}
              setFairnessScore={setFairnessScore}
              engagementLevel={engagementLevel}
              setEngagementLevel={setEngagementLevel}
              attendanceRequired={attendanceRequired}
              setAttendanceRequired={setAttendanceRequired}
              tags={tags}
              turnstileToken={turnstileToken}
              setTurnstileToken={setTurnstileToken}
              onSubmit={() => void handleSubmit()}
              onCloseReset={resetComposer}
              handleTagToggle={handleTagToggle}
            />
          </Suspense>
        ) : null}
      </div>
    </AppLayoutWrapper>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}:</span> {value}
    </div>
  );
}
