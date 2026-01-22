import { createFileRoute, Link } from "@tanstack/react-router";
import { GalleryVerticalEnd } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_index")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="." className="flex items-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-4" />
            </div>
            Claustrum
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link to="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link to="/signup">Sign Up</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto py-16 px-4">
        <div className="flex flex-col items-center text-center space-y-6 mb-16">
          <h1 className="text-4xl font-bold tracking-tight">
            Bienvenido a Claustrum.
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            La mejor solución para gestionar tus horarios de forma eficiente y
            colaborativa.
          </p>
          <div className="flex gap-4">
            <Button size="lg" asChild>
              <Link to="/signup">Comenzar ahora</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">Iniciar sesión</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
