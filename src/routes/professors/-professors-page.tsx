import { useDebouncedValue } from "@tanstack/react-pacer";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import type { ProfessorReviewStatsRow } from "@/lib/professor-reviews/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProfessorReviewStats } from "@/lib/hooks/use-professor-reviews";
import {
  getProfessorById,
  getProfessorReviewSummary,
  getProfessorReviewsPublic,
} from "@/lib/professor-reviews/api";
import { cn } from "@/lib/utils";
import { getProfessorNameTransitionName } from "@/lib/utils/view-transition";

const DEFAULT_PAGE_SIZE = 25;

function formatScore(score: number | null): string {
  if (score === null) return "-";
  return score.toFixed(2);
}

export function ProfessorsReviewsPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchInput, { wait: 300 });
  const [minAverageScoreInput, setMinAverageScoreInput] = useState("");
  const [minReviewCountInput, setMinReviewCountInput] = useState("0");
  const [courseCodeInput, setCourseCodeInput] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(0);

  const minAverageScore = minAverageScoreInput.trim() === "" ? null : Number(minAverageScoreInput);
  const minReviewCount = Number.isFinite(Number(minReviewCountInput))
    ? Number(minReviewCountInput)
    : 0;

  const query = useProfessorReviewStats({
    query: debouncedSearch,
    minAverageScore,
    minReviewCount,
    courseCode: courseCodeInput,
    onlyWithApprovedReviews: false,
    limit: pageSize,
    offset: page * pageSize,
  });

  const rows = query.data ?? [];
  const totalCount = rows[0]?.total_count ?? 0;
  const totalPages = totalCount === 0 ? 1 : Math.ceil(totalCount / pageSize);
  const hasMore = page + 1 < totalPages;
  const firstRow = rows.length === 0 ? 0 : page * pageSize + 1;
  const lastRow = page * pageSize + rows.length;

  const columns = useMemo<ColumnDef<ProfessorReviewStatsRow>[]>(
    () => [
      {
        accessorKey: "professor_name",
        header: "Nombre",
        cell: ({ row }) => {
          const professorId = row.original.professor_id;

          const prefetchProfessorDetail = () => {
            queryClient.setQueryData(["professorById", professorId], {
              id: professorId,
              full_name: row.original.professor_name,
            });
            void queryClient.prefetchQuery({
              queryKey: ["professorById", professorId],
              queryFn: () => getProfessorById(professorId),
            });
            void queryClient.prefetchQuery({
              queryKey: ["professorReviewsPublic", professorId, 0, 10],
              queryFn: () => getProfessorReviewsPublic(professorId, 10, 0),
            });
            void queryClient.prefetchQuery({
              queryKey: ["professorReviewSummary", professorId],
              queryFn: () => getProfessorReviewSummary(professorId),
            });
          };

          return (
            <Link
              to="/professors/$professorId"
              params={{ professorId: String(professorId) }}
              preload="intent"
              viewTransition={{ types: ["professor-open"] }}
              className="font-medium underline-offset-4 hover:underline"
              style={{ viewTransitionName: getProfessorNameTransitionName(professorId) }}
              onMouseEnter={prefetchProfessorDetail}
              onPointerDown={prefetchProfessorDetail}
              onTouchStart={prefetchProfessorDetail}
              onFocus={prefetchProfessorDetail}
            >
              {row.original.professor_name}
            </Link>
          );
        },
      },
      {
        accessorKey: "approved_review_count",
        header: "Reseñas",
        cell: ({ row }) => row.original.approved_review_count,
      },
      {
        accessorKey: "average_overall_score",
        header: "Promedio general",
        cell: ({ row }) => formatScore(row.original.average_overall_score),
      },
    ],
    [queryClient],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <Collapsible open={filtersExpanded} onOpenChange={setFiltersExpanded}>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-2">
            <Label htmlFor="professor-search" className="sr-only">
              Buscar por nombre de profesor
            </Label>
            <Input
              id="professor-search"
              placeholder="Ej: María González"
              aria-label="Buscar por nombre de profesor"
              value={searchInput}
              onChange={(event) => {
                setPage(0);
                setSearchInput(event.target.value);
              }}
            />
          </div>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={filtersExpanded ? "Ocultar filtros" : "Mostrar filtros"}
            >
              {filtersExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="grid gap-4 pt-3 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="min-average">Promedio mínimo</Label>
              <Input
                id="min-average"
                type="number"
                min={0}
                max={10}
                step={0.1}
                placeholder="0-10"
                value={minAverageScoreInput}
                onChange={(event) => {
                  setPage(0);
                  setMinAverageScoreInput(event.target.value);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="min-reviews">Mínimo de reseñas</Label>
              <Input
                id="min-reviews"
                type="number"
                min={0}
                step={1}
                value={minReviewCountInput}
                onChange={(event) => {
                  setPage(0);
                  setMinReviewCountInput(event.target.value);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="course-code">Código de curso</Label>
              <Input
                id="course-code"
                placeholder="CI1230"
                value={courseCodeInput}
                onChange={(event) => {
                  setPage(0);
                  setCourseCodeInput(event.target.value.toUpperCase());
                }}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Card className="py-0">
        <CardContent className="p-4">
          {rows.length === 0 && query.isLoading ? (
            <div className="text-muted-foreground text-sm">Cargando profesores…</div>
          ) : rows.length === 0 ? (
            <div className="text-muted-foreground text-sm">
              No hay resultados para los filtros seleccionados.
            </div>
          ) : (
            <div className="relative min-h-[420px]">
              {query.isFetching ? (
                <div className="bg-background/95 text-muted-foreground absolute top-2 right-2 z-10 rounded-md border px-2 py-1 text-xs">
                  Actualizando…
                </div>
              ) : null}
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <span className="text-muted-foreground text-xs">
              {rows.length === 0
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
                        setPage((value) => Math.max(value - 1, 0));
                      }}
                      aria-disabled={page === 0 || query.isFetching}
                      className={cn(
                        page === 0 || query.isFetching ? "pointer-events-none opacity-50" : "",
                      )}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
                        setPage((value) => value + 1);
                      }}
                      aria-disabled={!hasMore || query.isFetching}
                      className={cn(
                        !hasMore || query.isFetching ? "pointer-events-none opacity-50" : "",
                      )}
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
                  <SelectContent position="popper" align="end" sideOffset={4}>
                    <SelectItem value="25">25 filas</SelectItem>
                    <SelectItem value="50">50 filas</SelectItem>
                    <SelectItem value="100">100 filas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
