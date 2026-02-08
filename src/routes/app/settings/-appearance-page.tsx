import { useTheme } from "@/components/theme-provider";
import { PaletteIcon, SunIcon, MoonIcon, MonitorIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const themes = [
  {
    value: "light",
    label: "Claro",
    icon: SunIcon,
  },
  {
    value: "dark",
    label: "Oscuro",
    icon: MoonIcon,
  },
  {
    value: "system",
    label: "Sistema",
    icon: MonitorIcon,
  },
];

export function AppearancePage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <PaletteIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Tema</CardTitle>
              <CardDescription>Selecciona el tema de la aplicación</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Elige cómo quieres que se vea la aplicación. El tema del sistema
            se adaptará automáticamente a la configuración de tu dispositivo.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            {themes.map((themeOption) => {
              const isActive = theme === themeOption.value;
              const Icon = themeOption.icon;

              return (
                <button
                  key={themeOption.value}
                  onClick={() => setTheme(themeOption.value)}
                  className={cn(
                    "flex flex-col items-center gap-3 rounded-lg border-2 p-4 transition-all hover:border-primary/50",
                    isActive
                      ? "border-primary bg-primary/5"
                      : "border-muted bg-card hover:bg-accent"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full",
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-medium">{themeOption.label}</div>
                  {isActive && (
                    <div className="text-xs text-primary font-medium">
                      Activo
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Color de acento</CardTitle>
          <CardDescription>Personaliza el color de acento de la interfaz</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Esta funcionalidad estará disponible próximamente.
          </p>

          <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
            Podrás elegir entre varios colores de acento para personalizar
            la apariencia de la aplicación.
          </div>

          <Button variant="outline" disabled>
            <PaletteIcon className="mr-2 h-4 w-4" />
            Seleccionar color
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
