import { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

const ProfessorsReviewsPage = lazy(() =>
  import("./-professors-page").then((module) => ({ default: module.ProfessorsReviewsPage })),
);

export const Route = createFileRoute("/professors/")({
  component: ProfessorsRoute,
});

function ProfessorsRoute() {
  return (
    <Suspense fallback={<div className="flex-1 bg-background" />}>
      <ProfessorsReviewsPage />
    </Suspense>
  );
}
