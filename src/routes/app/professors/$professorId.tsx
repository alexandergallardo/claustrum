import { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

const ProfessorDetailPage = lazy(() =>
  import("./-professor-detail-page").then((module) => ({ default: module.ProfessorDetailPage })),
);

export const Route = createFileRoute("/app/professors/$professorId")({
  component: ProfessorDetailRoute,
});

function ProfessorDetailRoute() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-background" />}>
      <ProfessorDetailPage />
    </Suspense>
  );
}
