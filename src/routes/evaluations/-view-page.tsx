import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { RPProvider, RPDefaultLayout, RPPages } from "@pdf-viewer/react";

import { Button } from "@/components/ui/button";
import { getEvaluationSignedUrl } from "@/lib/evaluations/api";

export function EvaluationViewPage() {
  const navigate = useNavigate();
  const { key } = useSearch({ from: "/evaluations/view" });
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!key) {
      setError("No se especificó un archivo");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    async function load() {
      try {
        const url = await getEvaluationSignedUrl(key);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setBlobUrl(url);
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

  if (isLoading) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cargando documento...</p>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-destructive">{error ?? "No se pudo cargar el documento"}</p>
        <Button variant="outline" onClick={() => void navigate({ to: "/" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al inicio
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-svh flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => void navigate({ to: "/" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
      </div>
      <div className="flex-1 min-h-0">
        <RPProvider src={blobUrl}>
          <RPDefaultLayout style={{ height: "100%" }}>
            <RPPages />
          </RPDefaultLayout>
        </RPProvider>
      </div>
    </div>
  );
}
