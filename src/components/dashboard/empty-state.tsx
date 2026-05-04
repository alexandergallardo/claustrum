"use client"

import { Button } from "@/components/ui/button"
import { GraduationCap, ArrowRight } from "lucide-react"

interface EmptyDashboardProps {
  isAuthenticated: boolean
  hasProfile: boolean
}

export function EmptyDashboard({ isAuthenticated, hasProfile }: EmptyDashboardProps) {
  const title = !isAuthenticated
    ? "Bienvenido a Claustrum"
    : hasProfile
      ? "Aún no tienes un plan de estudios configurado"
      : "Completa tu perfil académico"

  const description = !isAuthenticated
    ? "Inicia sesión para ver tu plan de estudios y seguimiento de progreso académico."
    : hasProfile
      ? "Selecciona tu universidad, sede, carrera y plan de estudios para ver tu progreso académico."
      : "Agrega tu universidad, sede, carrera y plan para que podamos armar tu dashboard."

  const actionHref = hasProfile ? "/curriculum" : "/settings/profile"
  const actionLabel = hasProfile ? "Ir al Plan de Estudios" : "Configurar perfil"
  return (
    <div className="flex min-h-[calc(100svh-var(--header-height)-6rem)] flex-col items-center justify-center px-4 py-12 md:min-h-[calc(100svh-var(--header-height)-3rem)]">
      <div className="bg-primary/10 p-4 rounded-full mb-4">
        <GraduationCap className="h-12 w-12 text-primary" />
      </div>
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        {description}
      </p>
      {isAuthenticated ? (
        <a href={actionHref}>
          <Button>
            {actionLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
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
  )
}

function RadialProgressSkeleton() {
  return (
    <div className="bg-muted rounded-lg p-4 flex flex-col justify-center md:flex-row md:items-center gap-4">
      <div className="h-[100px] w-[100px] rounded-full bg-muted-foreground/20 shrink-0 self-center md:self-auto animate-pulse" />
      <div className="flex flex-col gap-1 text-center md:text-left w-full">
        <div className="h-4 w-24 bg-muted-foreground/20 rounded mx-auto md:mx-0" />
        <div className="h-7 w-16 bg-muted-foreground/20 rounded mx-auto md:mx-0" />
        <div className="h-3 w-28 bg-muted-foreground/20 rounded mx-auto md:mx-0" />
      </div>
    </div>
  )
}

function MiniBarSkeleton() {
  return (
    <div className="bg-muted rounded-lg p-4 space-y-2">
      <div className="h-4 w-24 bg-muted-foreground/20 rounded" />
      <div className="h-7 w-16 bg-muted-foreground/20 rounded" />
      <div className="h-2 w-full bg-muted-foreground/20 rounded-full" />
      <div className="h-3 w-20 bg-muted-foreground/20 rounded" />
    </div>
  )
}

export function DashboardStatsSkeleton() {
  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
      <RadialProgressSkeleton />
      <RadialProgressSkeleton />
      <MiniBarSkeleton />
      <MiniBarSkeleton />
      <MiniBarSkeleton />
      <MiniBarSkeleton />
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Stats cards - 6 cards in 2x3 grid */}
      <div className="px-4 lg:px-6">
        <DashboardStatsSkeleton />
      </div>

      {/* Distribution + Next courses row */}
      <div className="px-4 lg:px-6 mt-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <div className="h-64 bg-muted rounded-lg lg:col-span-4" />
          <div className="h-64 bg-muted rounded-lg lg:col-span-3" />
        </div>
      </div>

      {/* Timeline */}
      <div className="px-4 lg:px-6 mt-4">
        <div className="h-48 bg-muted rounded-lg" />
      </div>
    </div>
  )
}
