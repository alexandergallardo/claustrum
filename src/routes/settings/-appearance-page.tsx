import { SunIcon, MoonIcon, MonitorIcon } from "lucide-react";

import { SettingsPage, SettingsSection } from "@/components/settings/settings-section";
import { useTheme } from "@/components/theme-provider";
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
    <SettingsPage title="Apariencia" description="Ajusta cómo se ve Claustrum en este dispositivo.">
      <SettingsSection
        title="Tema"
        description="Define la superficie visual principal de la aplicación."
      >
        <div className="space-y-6">
          <p className="text-muted-foreground text-sm">
            Elige cómo quieres que se vea la aplicación. El tema del sistema se adaptará
            automáticamente a la configuración de tu dispositivo.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {themes.map((themeOption) => {
              const isActive = theme === themeOption.value;
              const Icon = themeOption.icon;

              return (
                <button
                  key={themeOption.value}
                  onClick={() => setTheme(themeOption.value)}
                  className={cn(
                    "hover:border-primary/50 hover:bg-accent/50 flex flex-col items-center gap-3 rounded-lg border p-4 text-center transition-colors",
                    isActive ? "border-primary bg-primary/5" : "border-border bg-background",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full",
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-medium">{themeOption.label}</div>
                  {isActive && <div className="text-primary text-xs font-medium">Activo</div>}
                </button>
              );
            })}
          </div>
        </div>
      </SettingsSection>
    </SettingsPage>
  );
}
