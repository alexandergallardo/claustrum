import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarDays, ChevronRight, GraduationCap, Home, Moon, Palette, Search, Settings, Shield, Sun, User, Users } from "lucide-react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useTheme } from "@/components/theme-provider";
import { useStudyPlanDetail, useStudyPlans } from "@/lib/hooks/use-queries";
import { useProfessorById } from "@/lib/hooks/use-professor-reviews";
import type { CatalogStudyPlan } from "@/lib/types";

type BreadcrumbItem = {
  label: string;
  to?: string;
  isLoading?: boolean;
};

const quickLinks = [
  { label: "Inicio", to: "/", icon: Home },
  { label: "Horarios", to: "/schedule", icon: CalendarDays },
  { label: "Plan de estudios", to: "/curriculum", icon: GraduationCap },
  { label: "Profesores", to: "/professors", icon: Users },
  { label: "Perfil", to: "/settings/profile", icon: User },
  { label: "Seguridad", to: "/settings/security", icon: Shield },
  { label: "Apariencia", to: "/settings/appearance", icon: Palette },
] as const;

const pageTitles: Record<string, string> = {
  "/": "Inicio",
  "/schedule": "Horarios",
  "/curriculum": "Plan de estudios",
  "/professors": "Profesores",
  "/policies": "Reglamento y políticas",
  "/settings/profile": "Perfil",
  "/settings/security": "Seguridad",
  "/settings/appearance": "Apariencia",
};

function getNumericPathSegment(pathname: string, prefix: string) {
  if (!pathname.startsWith(prefix)) return null;
  const raw = pathname.slice(prefix.length).split("/")[0];
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getSearchNumber(search: string, key: string) {
  const value = new URLSearchParams(search).get(key);
  if (!value) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function SiteHeader() {
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  const professorId = getNumericPathSegment(location.pathname, "/professors/");
  const isProfessorDetail = professorId !== null;
  const professorQuery = useProfessorById(professorId);
  const cachedProfessor = professorId
    ? queryClient.getQueryData<{ id: number; full_name: string }>(["professorById", professorId])
    : null;
  const professorName = professorQuery.data?.full_name ?? cachedProfessor?.full_name ?? null;

  const courseId = getNumericPathSegment(location.pathname, "/curriculum/");
  const isCourseDetail = courseId !== null;
  const selectedCareerId = isCourseDetail ? getSearchNumber(location.searchStr, "career") : null;
  const selectedPlanId = isCourseDetail ? getSearchNumber(location.searchStr, "plan") : null;
  const plansQuery = useStudyPlans(selectedCareerId);
  const selectedPlanData = plansQuery.data?.find((plan: CatalogStudyPlan) => plan.id === selectedPlanId);
  const planDetailQuery = useStudyPlanDetail(selectedPlanId, selectedPlanData);
  const courseLabel = useMemo(() => {
    if (!courseId) return null;

    for (const period of planDetailQuery.data?.periods ?? []) {
      const course = period.courses.find((item) => item.courseId === courseId);
      if (course) return `${course.courseCode} - ${course.courseName}`;
    }

    return null;
  }, [courseId, planDetailQuery.data]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandOpen((open) => !open);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function runCommand(callback: () => void) {
    setIsCommandOpen(false);
    callback();
  }

  const breadcrumbItems = useMemo<BreadcrumbItem[]>(() => {
    if (isCourseDetail) {
      return [
        { label: "Plan de estudios", to: "/curriculum" },
        { label: courseLabel ?? "", isLoading: !courseLabel && planDetailQuery.isLoading },
      ];
    }

    if (isProfessorDetail) {
      return [
        { label: "Profesores", to: "/professors" },
        { label: professorName ?? "", isLoading: !professorName && professorQuery.isLoading },
      ];
    }

    if (location.pathname.startsWith("/settings/")) {
      return [
        { label: "Configuración", to: "/settings/profile" },
        { label: pageTitles[location.pathname] ?? "" },
      ];
    }

    return [{ label: pageTitles[location.pathname] ?? "" }];
  }, [
    courseLabel,
    isCourseDetail,
    isProfessorDetail,
    location.pathname,
    planDetailQuery.isLoading,
    professorName,
    professorQuery.isLoading,
  ]);

  return (
    <header className="sticky top-0 z-40 hidden h-(--header-height) shrink-0 items-center bg-muted px-4 md:flex lg:px-6">
      <div className="grid w-full grid-cols-[1fr_auto] items-center gap-3 lg:grid-cols-[1fr_minmax(20rem,40rem)_1fr]">
        <div className="flex min-w-0 items-center gap-2">
          {breadcrumbItems.map((item, index) => {
            const isLast = index === breadcrumbItems.length - 1;

            return (
              <div key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">
                {index > 0 ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" /> : null}
                {item.isLoading ? (
                  <span className="h-4 w-40 animate-pulse rounded bg-muted-foreground/20" />
                ) : item.to && !isLast ? (
                  <Link
                    to={item.to}
                    className="truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="truncate text-sm font-medium text-muted-foreground">
                    {item.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setIsCommandOpen(true)}
          className="hidden h-11 items-center gap-3 rounded-full bg-background px-5 text-muted-foreground shadow-sm ring-1 ring-border/60 transition-colors hover:text-foreground hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:flex"
        >
          <Search className="size-5 shrink-0" />
          <span className="min-w-0 flex-1 text-left text-sm">Buscar...</span>
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notificaciones"
            title="Notificaciones"
            disabled
            className="rounded-full"
          >
            <Bell className="h-[1.2rem] w-[1.2rem]" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            title={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            className="rounded-full"
          >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
          <Button variant="ghost" size="icon" className="hidden rounded-full sm:inline-flex" asChild>
            <Link to="/settings/appearance" aria-label="Configuración" title="Configuración">
              <Settings className="h-[1.2rem] w-[1.2rem]" />
            </Link>
          </Button>
        </div>
      </div>
      <CommandDialog
        open={isCommandOpen}
        onOpenChange={setIsCommandOpen}
        title="Buscar en Claustrum"
        description="Busca rutas y acciones rápidas."
      >
        <CommandInput placeholder="Buscar rutas o acciones..." />
        <CommandList>
          <CommandEmpty>No se encontraron resultados.</CommandEmpty>
          <CommandGroup heading="Navegación">
            {quickLinks.map((item) => (
              <CommandItem
                key={item.to}
                value={`${item.label} ${item.to}`}
                onSelect={() => runCommand(() => void navigate({ to: item.to }))}
              >
                <item.icon />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Acciones">
            <CommandItem onSelect={() => runCommand(toggleTheme)}>
              {theme === "dark" ? <Sun /> : <Moon />}
              <span>{theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => void navigate({ to: "/settings/appearance" }))}>
              <Settings />
              <span>Abrir configuración</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </header>
  );
}
