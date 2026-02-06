import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Turnstile } from "@marsidev/react-turnstile";
import { ArrowLeft, PenLine } from "lucide-react";
import { toast } from "sonner";

import { AppLayoutWrapper } from "@/components/app-layout-wrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Textarea } from "@/components/ui/textarea";
import { getTurnstileSiteKey } from "@/lib/env/public";
import {
  useProfessorById,
  useProfessorReviewsPublic,
  useProfessorReviewSummary,
  useSubmitProfessorReview,
} from "@/lib/hooks/use-professor-reviews";
import { REVIEW_TAG_OPTIONS, type ReviewTag } from "@/lib/professor-reviews/types";
import { useIsMobile } from "@/hooks/use-mobile";

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

function scoreLabel(score: number | null) {
  if (score === null) return "En revisión";
  return score.toFixed(1);
}

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

        <Card>
          <CardContent className="space-y-4 p-4">
            <CardTitle className="text-base">Reseñas</CardTitle>
            {reviewsQuery.isLoading && reviewRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">Cargando reseñas...</div>
            ) : reviewRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">Aún no hay reseñas para este profesor.</div>
            ) : (
              <div className="divide-y rounded-md border">
                {reviewRows.map((review) => (
                  <article key={review.review_id} className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="text-sm font-medium">
                        {review.course_code} - {review.course_name}
                      </div>
                      <Badge variant={review.status === "approved" ? "default" : "outline"}>
                        {review.status === "approved" ? "Aprobada" : "En revisión"}
                      </Badge>
                    </div>

                    <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                      <div>
                        Asistencia: {review.attendance_required === null ? "En revisión" : review.attendance_required ? "Obligatoria" : "No obligatoria"}
                      </div>
                      <div>Calificación: {review.grade_received ?? "En revisión"}</div>
                      <div>Interés: {review.engagement_level ?? "En revisión"}</div>
                    </div>

                    <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
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

            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="text-xs text-muted-foreground">
                {reviewRows.length === 0
                  ? "Sin resultados"
                  : `Mostrando ${firstRow}-${lastRow} de ${totalCount}`} · Página {page + 1} de {totalPages}
              </span>
              <div className="flex items-center gap-3">
                <Pagination className="w-auto">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          setPage((value) => Math.max(value - 1, 0));
                        }}
                        aria-disabled={page === 0 || reviewsQuery.isFetching}
                        className={page === 0 || reviewsQuery.isFetching ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          setPage((value) => value + 1);
                        }}
                        aria-disabled={!hasMore || reviewsQuery.isFetching}
                        className={!hasMore || reviewsQuery.isFetching ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                <div className="w-28">
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => {
                      setPage(0);
                      setPageSize(Number(value));
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
          </CardContent>
        </Card>

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
          setTags={setTags}
          turnstileToken={turnstileToken}
          setTurnstileToken={setTurnstileToken}
          onSubmit={() => void handleSubmit()}
          onCloseReset={resetComposer}
          handleTagToggle={handleTagToggle}
        />
      </div>
    </AppLayoutWrapper>
  );
}

function ReviewComposer({
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
}: {
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
  setTags: (value: ReviewTag[]) => void;
  turnstileToken: string | null;
  setTurnstileToken: (value: string | null) => void;
  onSubmit: () => void;
  onCloseReset: () => void;
  handleTagToggle: (tag: ReviewTag, checked: boolean) => void;
}) {
  const [showReviewExample, setShowReviewExample] = useState(false);

  const form = (
    <div className="space-y-4 overflow-y-auto px-1 pb-2">
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
        <div className="space-y-2">
          <Label htmlFor="composer-engagement-level">Interés en la clase (1-5)</Label>
          <Input
            id="composer-engagement-level"
            type="number"
            min={1}
            max={5}
            step={1}
            value={engagementLevel}
            onChange={(event) => setEngagementLevel(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label className="block">Asistencia obligatoria</Label>
          <RadioGroup
            value={attendanceRequired ? "yes" : "no"}
            onValueChange={(value) => setAttendanceRequired(value === "yes")}
            className="flex gap-4"
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
              <Turnstile
                siteKey={turnstileSiteKey}
                options={{ language: "es", size: "normal" }}
                onSuccess={(token) => setTurnstileToken(token)}
                onError={() => setTurnstileToken(null)}
                onExpire={() => setTurnstileToken(null)}
              />
            </div>
          ) : (
            <p className="text-sm text-amber-600">
              Turnstile no está configurado. Define VITE_TURNSTILE_SITE_KEY para habilitar envío.
            </p>
          )}
        </div>
      </div>

      <Button onClick={onSubmit} disabled={submitMutationPending || !turnstileSiteKey || !turnstileToken}>
        {submitMutationPending ? "Enviando..." : "Enviar reseña"}
      </Button>
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

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}:</span> {value}
    </div>
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
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" min={0} max={10} step={0.1} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
