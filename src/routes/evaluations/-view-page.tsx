import { useEffect, useRef, useState } from "react";
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
  const [pageNumber, setPageNumber] = useState(1);
  const [pageRenderState, setPageRenderState] = useState<"idle" | "loading" | "ready">("idle");
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      setContainerWidth(el.clientWidth);
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [blobUrl]);

  useEffect(() => {
    if (numPages > 0) {
      setPageRenderState("loading");
    }
  }, [pageNumber, numPages]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
  }

  function onDocumentLoadError(err: Error) {
    setError(err.message);
  }

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > numPages) return;
    setPageNumber(newPage);
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

  const pageWidth = Math.max(200, containerWidth - 32);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background relative">
      <div className="flex items-center gap-2 border-b px-4 py-2 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-auto"
      >
        <div className="flex justify-center px-4 py-6">
          <Document
            file={blobUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="py-12 text-sm text-muted-foreground">Cargando PDF...</div>
            }
          >
            <div className="relative">
              <div
                className={`transition-opacity duration-200 ${pageRenderState === "ready" ? "opacity-100" : "opacity-0"}`}
              >
                <Page
                  pageNumber={pageNumber}
                  width={pageWidth}
                  renderTextLayer
                  renderAnnotationLayer
                  onRenderSuccess={() => setPageRenderState("ready")}
                />
              </div>
              {pageRenderState === "loading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
              onClick={() => handlePageChange(pageNumber - 1)}
              disabled={pageNumber <= 1}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground tabular-nums px-2">
              {pageNumber} de {numPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 cursor-pointer"
              onClick={() => handlePageChange(pageNumber + 1)}
              disabled={pageNumber >= numPages}
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
