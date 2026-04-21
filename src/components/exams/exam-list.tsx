import { useState } from "react";
import { FileText, Download, Eye, CheckCircle, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCourseExams, useExamDownloadUrl } from "@/lib/hooks/use-exams";
import { EXAM_TYPE_LABELS } from "@/lib/exams/types";
import { ExamPreviewDialog } from "./exam-preview-dialog";

interface ExamListProps {
  courseId: number;
}

export function ExamList({ courseId }: ExamListProps) {
  const { data: exams, isLoading } = useCourseExams(courseId);
  const [previewFileKey, setPreviewFileKey] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-8 w-full animate-pulse rounded bg-muted" />
        <div className="h-8 w-full animate-pulse rounded bg-muted" />
        <div className="h-8 w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!exams || exams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <FileText className="h-8 w-8 opacity-50" />
        <p>Aún no hay exámenes subidos para este curso.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Cátedra</TableHead>
            <TableHead>Profesor</TableHead>
            <TableHead>Respuestas</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {exams.map((exam) => (
            <TableRow key={exam.id}>
              <TableCell>
                <Badge variant="secondary" className="text-xs">
                  {EXAM_TYPE_LABELS[exam.exam_type]}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {exam.term_display_name ?? "—"}
              </TableCell>
              <TableCell className="text-sm">
                {exam.is_catedra ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Sí
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <HelpCircle className="h-3.5 w-3.5" />
                    No
                  </span>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {exam.professor_name ?? "—"}
              </TableCell>
              <TableCell className="text-sm">
                {exam.has_separate_answers
                  ? "Apartado"
                  : exam.includes_answers
                    ? "Incluidas"
                    : "No"}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPreviewFileKey(exam.exam_file_key)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <ExamDownloadButton fileKey={exam.exam_file_key} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ExamPreviewDialog
        fileKey={previewFileKey}
        onClose={() => setPreviewFileKey(null)}
      />
    </div>
  );
}

function ExamDownloadButton({ fileKey }: { fileKey: string }) {
  const { data: url } = useExamDownloadUrl(fileKey);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      asChild
      disabled={!url}
    >
      <a href={url ?? "#"} download target="_blank" rel="noopener noreferrer">
        <Download className="h-4 w-4" />
      </a>
    </Button>
  );
}
