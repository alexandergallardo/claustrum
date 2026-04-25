import { useEffect, useMemo, useRef, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { ArrowLeft, Download, Loader2, Minus, Plus } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";

import { Button } from "@/components/ui/button";
import { getEvaluationSignedUrl } from "@/lib/evaluations/api";
import { formatEvaluationFileName } from "@/lib/evaluations/types";

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

  const { key, courseCode, evaluationType, evaluationNumber, customName } = useSearch({ from: "/evaluations/view" });
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pendingCenterRatioRef = useRef<number | null>(null);
  const shouldCenterOnLoadRef = useRef(true);

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

  function onDocumentLoadSuccess({ numPages }: PDFDocumentProxy) {
    setNumPages(numPages);
    pendingCenterRatioRef.current = 0.5;
    shouldCenterOnLoadRef.current = true;
    setZoom(1);
  }

  function onDocumentLoadError(err: Error) {
    setError(err.message);
  }

  function handleZoomChange(delta: number) {
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number((zoom + delta).toFixed(1))));
    if (nextZoom === zoom) return;

    const container = scrollContainerRef.current;
    if (container) {
      const viewportCenter = container.scrollLeft + container.clientWidth / 2;
      pendingCenterRatioRef.current =
        container.scrollWidth > 0 ? viewportCenter / container.scrollWidth : 0.5;
    }

    setZoom(nextZoom);
  }

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateWidth = () => {
      setContainerWidth(container.clientWidth);
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isLoading]);

  const isReady = containerWidth > 0 && numPages > 0;

  const pageWidth =
    containerWidth > 0
      ? Math.max(220, Math.floor((containerWidth - 32) * zoom))
      : undefined;

  const downloadFileName = useMemo(() => {
    if (courseCode && evaluationType) {
      return formatEvaluationFileName(
        courseCode,
        evaluationType,
        evaluationNumber ?? null,
        customName ?? null,
      );
    }

    if (!key) {
      return "evaluacion.pdf";
    }

    const cleanKey = key.split("?")[0] ?? key;
    const lastSegment = cleanKey.split("/").filter(Boolean).pop();

    if (!lastSegment) {
      return "evaluacion.pdf";
    }

    const decoded = decodeURIComponent(lastSegment);
    return decoded.toLowerCase().endsWith(".pdf") ? decoded : `${decoded}.pdf`;
  }, [courseCode, customName, evaluationNumber, evaluationType, key]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || numPages === 0) return;

    const ratio = pendingCenterRatioRef.current;
    const shouldCenter = ratio !== null || shouldCenterOnLoadRef.current;
    if (!shouldCenter) return;

    const centerRatio = ratio ?? 0.5;

    const raf = requestAnimationFrame(() => {
      const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
      const target = centerRatio * container.scrollWidth - container.clientWidth / 2;
      container.scrollLeft = Math.min(maxScrollLeft, Math.max(0, target));
      pendingCenterRatioRef.current = null;
      shouldCenterOnLoadRef.current = false;
    });

    return () => cancelAnimationFrame(raf);
  }, [numPages, pageWidth]);

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
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-none bg-background sm:rounded-b-xl">
      <div ref={scrollContainerRef} className="flex-1 min-h-0 w-full overflow-auto overscroll-contain">
        <div className="flex justify-start py-4">
          <Document
            file={blobUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="py-12 text-sm text-muted-foreground">Cargando PDF...</div>
            }
          >
            {isReady ? (
              <div className="flex min-w-full w-max flex-col items-start gap-4 px-4 [&_.react-pdf__Page__canvas]:!h-auto [&_.react-pdf__Page__canvas]:max-w-none [&_.react-pdf__Page__canvas]:rounded-md [&_.react-pdf__Page__canvas]:shadow-lg">
                {Array.from({ length: numPages }, (_, index) => (
                  <Page
                    key={`page_${index + 1}`}
                    pageNumber={index + 1}
                    width={pageWidth}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    loading={null}
                  />
                ))}
              </div>
            ) : (
              <div className="py-12 text-sm text-muted-foreground">Cargando PDF...</div>
            )}
          </Document>
        </div>
      </div>

      {numPages > 0 && (
        <div className="absolute inset-x-0 bottom-6 z-50 flex justify-center px-2">
          <div className="flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto rounded-full border bg-background/90 px-2 py-1 shadow-lg backdrop-blur-sm">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 cursor-pointer"
              onClick={() => window.history.back()}
              aria-label="Volver"
              title="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="mx-1 h-4 w-px bg-border" />
            <div className="hidden items-center min-[430px]:flex">
              <span className="shrink-0 whitespace-nowrap px-2 text-sm text-muted-foreground tabular-nums">
                {numPages} páginas
              </span>
              <div className="mx-1 h-4 w-px bg-border" />
            </div>
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
            <div className="mx-1 h-4 w-px bg-border" />
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-8 w-8 cursor-pointer"
            >
              <a href={blobUrl} download={downloadFileName} aria-label="Descargar PDF" title="Descargar PDF">
                <Download className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
