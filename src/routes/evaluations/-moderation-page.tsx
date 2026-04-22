import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useEvaluationModerationQueue,
  useModerateEvaluation,
} from "@/lib/hooks/use-evaluations";
import { useIsAdmin } from "@/lib/hooks/use-professor-reviews";
import { useAuthUser } from "@/lib/hooks/use-queries";
import { formatEvaluationTypeLabel } from "@/lib/evaluations/types";

const PAGE_SIZE = 20;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EvaluationModerationPage() {
  const navigate = useNavigate({ from: "/evaluations/moderation" });
  const { data: authUser, isLoading: isAuthLoading } = useAuthUser();
  const [page, setPage] = useState(0);
  const [moderationNote, setModerationNote] = useState<Record<number, string>>({});
  const isAdminQuery = useIsAdmin();
  const queueQuery = useEvaluationModerationQueue("pending", page, PAGE_SIZE);
  const moderateMutation = useModerateEvaluation();

  const rows = queueQuery.data ?? [];
  const totalCount = rows[0]?.total_count ?? 0;
  const hasMore = totalCount > (page + 1) * PAGE_SIZE;

  const canModerate = useMemo(() => isAdminQuery.data === true, [isAdminQuery.data]);

  useEffect(() => {
    if (isAuthLoading || isAdminQuery.isLoading) return;
    if (!authUser || !canModerate) {
      void navigate({ to: "/" });
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

  const handleModeration = async (evaluationId: number, status: "approved" | "rejected") => {
    try {
      await moderateMutation.mutateAsync({
        evaluationId,
        status,
        note: moderationNote[evaluationId] ?? "",
      });
      toast.success(status === "approved" ? "Evaluación aprobada" : "Evaluación rechazada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo moderar la evaluación.");
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Moderación de evaluaciones</h1>
        <Badge variant="outline">{totalCount} pendientes</Badge>
      </div>

      {queueQuery.isLoading ? (
        <div className="text-sm text-muted-foreground">Cargando cola de moderación...</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">No hay evaluaciones pendientes por moderar.</div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Profesor</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Tamaño</TableHead>
                  <TableHead>Cátedra</TableHead>
                  <TableHead>Respuestas</TableHead>
                  <TableHead className="w-40">Nota</TableHead>
                  <TableHead className="w-48">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((evaluation) => (
                  <TableRow key={evaluation.id}>
                    <TableCell className="text-sm font-mono">#{evaluation.id}</TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{evaluation.course_code}</div>
                      <div className="text-muted-foreground">{evaluation.course_name}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {formatEvaluationTypeLabel(evaluation.evaluation_type, evaluation.evaluation_number, evaluation.custom_name)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {evaluation.term_display_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {evaluation.professor_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {evaluation.uploader_email ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {formatFileSize(evaluation.file_size)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {evaluation.is_catedra ? "Sí" : "No"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {evaluation.has_separate_answers
                        ? "Archivo aparte"
                        : evaluation.includes_answers
                          ? "Incluidas"
                          : "No"}
                    </TableCell>
                    <TableCell>
                      <Textarea
                        id={`note-${evaluation.id}`}
                        value={moderationNote[evaluation.id] ?? ""}
                        onChange={(event) =>
                          setModerationNote((previous) => ({
                            ...previous,
                            [evaluation.id]: event.target.value,
                          }))
                        }
                        className="min-h-0 h-16 text-xs"
                        placeholder="Opcional"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => void handleModeration(evaluation.id, "approved")}
                          disabled={moderateMutation.isPending}
                        >
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => void handleModeration(evaluation.id, "rejected")}
                          disabled={moderateMutation.isPending}
                        >
                          Rechazar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Página {page + 1}</span>
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
        </div>
      )}
    </div>
  );
}
