import { Suspense, lazy } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";

const EvaluationViewPage = lazy(() =>
  import("./-view-page").then((module) => ({ default: module.EvaluationViewPage })),
);

export const Route = createFileRoute("/evaluations/view/$evaluationSlug")({
  loader: ({ params }) => {
    const match = params.evaluationSlug.match(/^(\d+)\.pdf$/);
    if (!match) throw notFound();
    return { evaluationId: parseInt(match[1], 10) };
  },
  component: EvaluationSlugRoute,
});

function EvaluationSlugRoute() {
  return (
    <Suspense fallback={<div className="flex-1 bg-background" />}>
      <EvaluationViewPage />
    </Suspense>
  );
}
