import { useEffect, useState } from "react";
import { ImageDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type ScheduleExportFormat = "png" | "jpeg";
export type ScheduleExportTheme = "light" | "dark";

export interface ScheduleExportOptions {
  format: ScheduleExportFormat;
  theme: ScheduleExportTheme;
  transparent: boolean;
}

interface ScheduleExportDialogProps {
  onExport: (options: ScheduleExportOptions) => Promise<void> | void;
}

export function ScheduleExportDialog({ onExport }: ScheduleExportDialogProps) {
  const [format, setFormat] = useState<ScheduleExportFormat>("png");
  const [theme, setTheme] = useState<ScheduleExportTheme>("light");
  const [transparent, setTransparent] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (typeof document === "undefined") return;
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, [isOpen]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport({ format, theme, transparent });
      setIsOpen(false);
    } finally {
      setIsExporting(false);
    }
  };

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
            Descarga el horario en formato imagen con el estilo que prefieras.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Formato</Label>
            <Select
              value={format}
              onValueChange={(value) => setFormat(value as ScheduleExportFormat)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un formato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="png">PNG</SelectItem>
                <SelectItem value="jpeg">JPEG / JPG</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Modo</Label>
            <Select
              value={theme}
              onValueChange={(value) => setTheme(value as ScheduleExportTheme)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un modo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Oscuro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-1">
              <Label>Fondo transparente</Label>
              <p className="text-sm text-muted-foreground">
                Ideal para insertar en documentos o presentaciones.
              </p>
            </div>
            <Switch checked={transparent} onCheckedChange={setTransparent} />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? "Exportando..." : "Exportar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
