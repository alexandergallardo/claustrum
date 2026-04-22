import { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const EvaluationViewPage = lazy(() =>
  import("./-view-page").then((module) => ({ default: module.EvaluationViewPage })),
);

const viewSearchSchema = z.object({
  key: z.string().min(1),
});

export const Route = createFileRoute("/evaluations/view")({
  validateSearch: viewSearchSchema,
  component: EvaluationViewRoute,
});

function EvaluationViewRoute() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-background" />}>
      <EvaluationViewPage />
    </Suspense>
  );
}
