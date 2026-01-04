import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  UserIcon,
  ShieldIcon,
  PaletteIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { AppLayoutWrapper } from "@/components/app-layout-wrapper";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/app/settings")({
  component: SettingsLayout,
});

const navItems = [
  {
    label: "Perfil",
    path: "/app/settings/profile",
    icon: UserIcon,
  },
  {
    label: "Seguridad",
    path: "/app/settings/security",
    icon: ShieldIcon,
  },
  {
    label: "Apariencia",
    path: "/app/settings/appearance",
    icon: PaletteIcon,
  },
];

function SettingsLayout() {
  const location = useLocation();

  return (
    <AppLayoutWrapper>
      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
          <p className="text-muted-foreground text-sm">
            Gestiona tu cuenta y preferencias
          </p>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:gap-6">
          <Card className="w-full lg:w-64 shrink-0 self-start py-0">
            <CardContent className="p-2">
              <nav className="flex flex-col gap-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </CardContent>
          </Card>

          <Card className="flex-1 py-0">
            <CardContent className="p-6">
              <Outlet />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayoutWrapper>
  );
}
