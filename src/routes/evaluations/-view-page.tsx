import { useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";

import { Button } from "@/components/ui/button";
import { getEvaluationSignedUrl } from "@/lib/evaluations/api";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export function EvaluationViewPage() {
  const { key } = useSearch({ from: "/evaluations/view" });
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [displayPage, setDisplayPage] = useState(1);
  const [pendingPage, setPendingPage] = useState<number | null>(null);

  useEffect(() => {
    if (!key) {
      setError("No se especificó un archivo");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    const isDirectUrl =
      key.startsWith("/") ||
      key.startsWith("http://") ||
      key.startsWith("https://");

    async function load() {
      try {
        if (isDirectUrl) {
          const response = await fetch(key);
          if (!response.ok) throw new Error("No se pudo cargar el PDF");
          const blob = await response.blob();
          objectUrl = URL.createObjectURL(blob);
          if (cancelled) {
            URL.revokeObjectURL(objectUrl);
            return;
          }
          setBlobUrl(objectUrl);
        } else {
          const url = await getEvaluationSignedUrl(key);
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          objectUrl = url;
          setBlobUrl(url);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo cargar el PDF");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [key]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setDisplayPage(1);
    setPendingPage(null);
  }

  function onDocumentLoadError(err: Error) {
    setError(err.message);
  }

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > numPages) return;
    if (newPage === displayPage) return;
    setPendingPage(newPage);
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cargando documento...</p>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-destructive">{error ?? "No se pudo cargar el documento"}</p>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="shrink-0 border-b px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto overscroll-contain">
        <div className="flex justify-center px-4 py-6">
          <Document
            file={blobUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="py-12 text-sm text-muted-foreground">Cargando PDF...</div>
            }
          >
            <div className="relative w-full max-w-5xl [&_.react-pdf__Page]:w-full [&_.react-pdf__Page]:max-w-full [&_.react-pdf__Page__canvas]:!h-auto [&_.react-pdf__Page__canvas]:!w-full">
              <Page
                pageNumber={displayPage}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />

              {pendingPage !== null && pendingPage !== displayPage && (
                <div className="pointer-events-none absolute inset-0 opacity-0">
                  <Page
                    pageNumber={pendingPage}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    onRenderSuccess={() => {
                      setDisplayPage(pendingPage);
                      setPendingPage(null);
                    }}
                  />
                </div>
              )}
            </div>
          </Document>
        </div>
      </div>

      {numPages > 0 && (
        <div className="absolute bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-1 rounded-full border bg-background/90 px-2 py-1 shadow-lg backdrop-blur-sm">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 cursor-pointer"
              onClick={() => handlePageChange(displayPage - 1)}
              disabled={displayPage <= 1}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm text-muted-foreground tabular-nums">
              {displayPage} de {numPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 cursor-pointer"
              onClick={() => handlePageChange(displayPage + 1)}
              disabled={displayPage >= numPages}
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
