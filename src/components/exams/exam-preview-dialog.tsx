import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useExamDownloadUrl } from "@/lib/hooks/use-exams";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface ExamPreviewDialogProps {
  fileKey: string | null;
  onClose: () => void;
}

export function ExamPreviewDialog({ fileKey, onClose }: ExamPreviewDialogProps) {
  const { data: url } = useExamDownloadUrl(fileKey);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);

  useEffect(() => {
    if (fileKey) {
      setPageNumber(1);
      setNumPages(0);
    }
  }, [fileKey]);

  if (!fileKey) return null;

  return (
    <Dialog open={!!fileKey} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] grid-rows-[auto_1fr] overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Vista previa del examen</DialogTitle>
          <div className="flex items-center gap-2">
            {url && (
              <Button variant="outline" size="sm" asChild>
                <a href={url} download target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  Descargar
                </a>
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="min-h-0">
          {url ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <Document
                file={url}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                loading={
                  <div className="flex h-[600px] w-full items-center justify-center">
                    <p className="text-sm text-muted-foreground">Cargando PDF...</p>
                  </div>
                }
                error={
                  <div className="flex h-[200px] w-full items-center justify-center">
                    <p className="text-sm text-muted-foreground">Error al cargar el PDF.</p>
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  width={700}
                  renderTextLayer
                  renderAnnotationLayer
                />
              </Document>

              {numPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                    disabled={pageNumber <= 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {pageNumber} de {numPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                    disabled={pageNumber >= numPages}
                  >
                    Siguiente
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-[400px] items-center justify-center">
              <p className="text-sm text-muted-foreground">Cargando...</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
