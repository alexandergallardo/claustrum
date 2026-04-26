import { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

const EvaluationModerationPage = lazy(() =>
  import("./-moderation-page").then((module) => ({ default: module.EvaluationModerationPage })),
);

export const Route = createFileRoute("/evaluations/moderation")({
  component: EvaluationModerationRoute,
});

function EvaluationModerationRoute() {
  return (
    <Suspense fallback={<div className="flex-1 bg-background" />}>
      <EvaluationModerationPage />
    </Suspense>
  );
}
