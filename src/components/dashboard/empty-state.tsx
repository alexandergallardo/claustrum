"use client";

import { GraduationCap, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

interface EmptyDashboardProps {
  isAuthenticated: boolean;
  hasProfile: boolean;
}

export function EmptyDashboard({ isAuthenticated, hasProfile }: EmptyDashboardProps) {
  const title = !isAuthenticated
    ? "Bienvenido a Claustrum"
    : hasProfile
      ? "Aún no tienes un plan de estudios configurado"
      : "Completa tu perfil académico";

  const description = !isAuthenticated
    ? "Inicia sesión para ver tu plan de estudios y seguimiento de progreso académico."
    : hasProfile
      ? "Selecciona tu universidad, sede, carrera y plan de estudios para ver tu progreso académico."
      : "Agrega tu universidad, sede, carrera y plan para que podamos armar tu dashboard.";

  const actionHref = hasProfile ? "/curriculum" : "/settings/profile";
  const actionLabel = hasProfile ? "Ir al Plan de Estudios" : "Configurar perfil";
  return (
    <div className="flex min-h-[calc(100svh-var(--header-height)-6rem)] flex-col items-center justify-center px-4 py-12 md:min-h-[calc(100svh-var(--header-height)-3rem)]">
      <div className="bg-primary/10 mb-4 rounded-full p-4">
        <GraduationCap className="text-primary size-12" />
      </div>
      <h2 className="mb-2 text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground mb-6 max-w-md text-center">{description}</p>
      {isAuthenticated ? (
        <a href={actionHref}>
          <Button>
            {actionLabel}
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </a>
      ) : (
        <div className="flex gap-3">
          <a href="/auth/signin">
            <Button>Iniciar sesión</Button>
          </a>
          <a href="/auth/signup">
            <Button variant="outline">Registrarse</Button>
          </a>
        </div>
      )}
    </div>
  );
}

function RadialProgressSkeleton() {
  return (
    <div className="bg-muted flex flex-col justify-center gap-4 rounded-lg p-4 md:flex-row md:items-center">
      <div className="bg-muted-foreground/20 size-[100px] shrink-0 animate-pulse self-center rounded-full md:self-auto" />
      <div className="flex w-full flex-col gap-1 text-center md:text-left">
        <div className="bg-muted-foreground/20 mx-auto h-4 w-24 rounded md:mx-0" />
        <div className="bg-muted-foreground/20 mx-auto h-7 w-16 rounded md:mx-0" />
        <div className="bg-muted-foreground/20 mx-auto h-3 w-28 rounded md:mx-0" />
      </div>
    </div>
  );
}

function MiniBarSkeleton() {
  return (
    <div className="bg-muted space-y-2 rounded-lg p-4">
      <div className="bg-muted-foreground/20 h-4 w-24 rounded" />
      <div className="bg-muted-foreground/20 h-7 w-16 rounded" />
      <div className="bg-muted-foreground/20 h-2 w-full rounded-full" />
      <div className="bg-muted-foreground/20 h-3 w-20 rounded" />
    </div>
  );
}

export function CourseStatusChartSkeleton() {
  return (
    <div className="bg-card rounded-xl border p-3">
      <div className="bg-muted-foreground/20 mb-3 h-5 w-40 rounded" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="bg-muted-foreground/20 h-4 w-24 rounded" />
              <div className="bg-muted-foreground/20 h-4 w-16 rounded" />
            </div>
            <div className="bg-muted h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <RadialProgressSkeleton />
      <RadialProgressSkeleton />
      <MiniBarSkeleton />
      <MiniBarSkeleton />
      <MiniBarSkeleton />
      <MiniBarSkeleton />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Stats cards - 6 cards in 2x3 grid */}
      <div className="px-4 lg:px-6">
        <DashboardStatsSkeleton />
      </div>

      {/* Distribution + Next courses row */}
      <div className="mt-4 px-4 lg:px-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <div className="lg:col-span-4">
            <CourseStatusChartSkeleton />
          </div>

          <div className="bg-card rounded-xl border p-3 lg:col-span-3">
            <div className="bg-muted-foreground/20 mb-3 h-5 w-36 rounded" />
            <div className="space-y-2">
              <div className="bg-muted h-12 rounded-lg" />
              <div className="bg-muted h-12 rounded-lg" />
              <div className="bg-muted h-12 rounded-lg" />
              <div className="bg-muted h-12 rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-4 px-4 lg:px-6">
        <div className="bg-muted h-48 rounded-lg" />
      </div>
    </div>
  );
}
