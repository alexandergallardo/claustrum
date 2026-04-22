import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEvaluationSignedUrl } from "@/lib/hooks/use-evaluations";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface EvaluationPreviewDialogProps {
  fileKey: string | null;
  onClose: () => void;
}

export function EvaluationPreviewDialog({ fileKey, onClose }: EvaluationPreviewDialogProps) {
  const { data: signedUrl, isLoading: isUrlLoading } = useEvaluationSignedUrl(fileKey);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    if (fileKey) {
      setPageNumber(1);
      setNumPages(0);
      setPdfError(null);
    }
  }, [fileKey]);

  const isOpen = !!fileKey;

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
    setPdfError(null);
  }

  function onDocumentLoadError(error: Error) {
    setPdfError(error.message);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-base">Vista previa de la evaluación</DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-auto flex flex-col items-center min-h-0">
          {isUrlLoading ? (
            <div className="py-12 text-sm text-muted-foreground">
              Cargando documento...
            </div>
          ) : pdfError ? (
            <div className="py-12 text-sm text-destructive">
              No se pudo cargar el PDF: {pdfError}
            </div>
          ) : signedUrl ? (
            <>
              <Document
                file={signedUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="py-12 text-sm text-muted-foreground">
                    Cargando PDF...
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  width={Math.min(720, typeof window !== "undefined" ? window.innerWidth - 64 : 720)}
                  renderTextLayer
                  renderAnnotationLayer
                />
              </Document>

              {numPages > 1 && (
                <div className="flex items-center gap-3 py-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                    disabled={pageNumber <= 1}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {pageNumber} de {numPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                    disabled={pageNumber >= numPages}
                    aria-label="Página siguiente"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-sm text-muted-foreground">
              No se pudo obtener el documento.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
