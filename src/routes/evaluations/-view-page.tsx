import { useEffect, useRef, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Minus, Plus } from "lucide-react";
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
  const MIN_ZOOM = 0.6;
  const MAX_ZOOM = 2;
  const ZOOM_STEP = 0.2;

  const { key } = useSearch({ from: "/evaluations/view" });
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

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
    setPageNumber(1);
    setZoom(1);
  }

  function onDocumentLoadError(err: Error) {
    setError(err.message);
  }

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > numPages) return;
    if (newPage === pageNumber) return;
    setPageNumber(newPage);
  }

  function handleZoomChange(delta: number) {
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number((zoom + delta).toFixed(1))));
    if (nextZoom === zoom) return;
    setZoom(nextZoom);
  }

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const centerX = () => {
      const target = Math.max(0, (container.scrollWidth - container.clientWidth) / 2);
      container.scrollLeft = target;
    };

    const raf = requestAnimationFrame(centerX);
    return () => cancelAnimationFrame(raf);
  }, [zoom, pageNumber]);

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
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-xl bg-background">
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-auto overscroll-contain">
        <div className="flex justify-center px-4 py-6">
          <Document
            file={blobUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="py-12 text-sm text-muted-foreground">Cargando PDF...</div>
            }
          >
            <div className="relative inline-block [&_.react-pdf__Page]:mx-auto [&_.react-pdf__Page__canvas]:!h-auto">
              <Page
                pageNumber={pageNumber}
                scale={zoom}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading={null}
              />
            </div>
          </Document>
        </div>
      </div>

      <div className="absolute left-4 top-4 z-50">
        <Button
          variant="secondary"
          size="sm"
          className="cursor-pointer rounded-full border bg-background/95 shadow-lg backdrop-blur-sm"
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
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
            <span className="px-2 text-sm text-muted-foreground tabular-nums whitespace-nowrap">
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
            <div className="mx-1 h-4 w-px bg-border" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 cursor-pointer"
              onClick={() => handleZoomChange(-ZOOM_STEP)}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Reducir zoom"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-12 text-center text-sm text-muted-foreground tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 cursor-pointer"
              onClick={() => handleZoomChange(ZOOM_STEP)}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Aumentar zoom"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
