"use client"

import { Button } from "@/components/ui/button"
import { GraduationCap, ArrowRight } from "lucide-react"

interface EmptyDashboardProps {
  isAuthenticated: boolean
}

export function EmptyDashboard({ isAuthenticated }: EmptyDashboardProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="bg-primary/10 p-4 rounded-full mb-4">
        <GraduationCap className="h-12 w-12 text-primary" />
      </div>
      <h2 className="text-xl font-semibold mb-2">
        {isAuthenticated
          ? "Aún no tienes un plan de estudios configurado"
          : "Bienvenido a Claustrum"}
      </h2>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        {isAuthenticated
          ? "Selecciona tu universidad, sede, carrera y plan de estudios para ver tu progreso académico."
          : "Inicia sesión para ver tu plan de estudios y seguimiento de progreso académico."}
      </p>
      {isAuthenticated ? (
        <a href="/app/curriculum">
          <Button>
            Ir al Plan de Estudios
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </a>
      ) : (
        <div className="flex gap-3">
          <a href="/login">
            <Button>Iniciar Sesión</Button>
          </a>
          <a href="/signup">
            <Button variant="outline">Registrarse</Button>
          </a>
        </div>
      )}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Title area */}
      <div className="px-4 lg:px-6 space-y-2">
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="h-5 w-48 bg-muted rounded" />
      </div>

      {/* Stats cards - 6 cards in 2x3 grid with bar charts */}
      <div className="px-4 lg:px-6 mt-4 md:mt-6">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-muted rounded-lg p-4 space-y-2">
              <div className="h-4 w-24 bg-muted-foreground/20 rounded" />
              <div className="h-7 w-16 bg-muted-foreground/20 rounded" />
              <div className="h-2 w-full bg-muted-foreground/20 rounded-full" />
              <div className="h-3 w-20 bg-muted-foreground/20 rounded" />
            </div>
          ))}
        </div>
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
