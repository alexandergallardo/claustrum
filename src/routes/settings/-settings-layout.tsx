import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { UserIcon, ShieldIcon, PaletteIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Perfil",
    path: "/settings/profile",
    icon: UserIcon,
  },
  {
    label: "Seguridad",
    path: "/settings/security",
    icon: ShieldIcon,
  },
  {
    label: "Apariencia",
    path: "/settings/appearance",
    icon: PaletteIcon,
  },
];

export function SettingsLayout() {
  const location = useLocation();

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-6">
        <Card className="w-full shrink-0 self-start py-0 lg:w-64">
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
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <item.icon className="size-4" />
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
  );
}
