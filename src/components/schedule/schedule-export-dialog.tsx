import { ImageDown } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export type ScheduleExportFormat = "png" | "jpeg" | "ics";
export type ScheduleExportTheme = "light" | "dark";

export interface ScheduleExportOptions {
  format: ScheduleExportFormat;
  theme: ScheduleExportTheme;
  transparent: boolean;
}

const formatOptions: Array<{
  value: ScheduleExportFormat;
  title: string;
  description: string;
}> = [
  {
    value: "png",
    title: "PNG",
    description: "Imagen con fondo transparente.",
  },
  {
    value: "jpeg",
    title: "JPEG",
    description: "Imagen liviana con fondo sólido.",
  },
  {
    value: "ics",
    title: "Calendario",
    description: "Archivo .ics para apps de calendario.",
  },
];

const themeOptions: Array<{
  value: ScheduleExportTheme;
  title: string;
  description: string;
}> = [
  {
    value: "light",
    title: "Claro",
    description: "Fondo blanco y texto oscuro.",
  },
  {
    value: "dark",
    title: "Oscuro",
    description: "Fondo oscuro y texto claro.",
  },
];

interface ScheduleExportDialogProps {
  onExport: (options: ScheduleExportOptions) => Promise<void> | void;
}

export function ScheduleExportDialog({ onExport }: ScheduleExportDialogProps) {
  const [format, setFormat] = useState<ScheduleExportFormat>("png");
  const [theme, setTheme] = useState<ScheduleExportTheme>("light");
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isOpen) return;
    if (typeof document === "undefined") return;
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, [isOpen]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport({ format, theme, transparent: format === "png" });
      setIsOpen(false);
    } finally {
      setIsExporting(false);
    }
  };

  const formFields = (
    <div className="space-y-5">
      <div className="space-y-2.5">
        <Label>Formato</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {formatOptions.map((option) => {
            const isSelected = format === option.value;

            return (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "hover:border-primary/60 hover:bg-muted/40 rounded-xl border p-3 text-left transition-all",
                  isSelected && "border-primary bg-primary/5 shadow-sm",
                )}
                onClick={() => setFormat(option.value)}
              >
                <span className="block text-sm leading-none font-semibold">{option.title}</span>
                <span className="text-muted-foreground mt-1.5 block text-xs leading-snug">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {format !== "ics" && (
        <div className="space-y-2.5">
          <Label>Modo</Label>
          <div className="bg-muted/20 grid grid-cols-2 gap-2 rounded-xl border p-1">
            {themeOptions.map((option) => {
              const isSelected = theme === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-left transition-all",
                    isSelected
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                  )}
                  onClick={() => setTheme(option.value)}
                >
                  <span className="block text-sm leading-none font-semibold">{option.title}</span>
                  <span className="mt-1 block text-xs leading-snug">{option.description}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <>
        <Button
          variant="outline"
          size="icon"
          title="Exportar calendario"
          onClick={() => setIsOpen(true)}
        >
          <ImageDown className="h-4 w-4" />
        </Button>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetContent side="bottom" className="h-[90vh] overflow-hidden p-0">
            <SheetHeader>
              <SheetTitle>Exportar calendario</SheetTitle>
              <SheetDescription>
                Descarga el horario como imagen o archivo de calendario.
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              {formFields}
              <div className="mt-5">
                <Button onClick={handleExport} disabled={isExporting} className="w-full">
                  {isExporting ? "Exportando..." : format === "ics" ? "Descargar" : "Exportar"}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Exportar calendario">
          <ImageDown className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exportar calendario</DialogTitle>
          <DialogDescription>
            Descarga el horario como imagen o archivo de calendario.
          </DialogDescription>
        </DialogHeader>

        {formFields}

        <DialogFooter>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? "Exportando..." : format === "ics" ? "Descargar" : "Exportar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
