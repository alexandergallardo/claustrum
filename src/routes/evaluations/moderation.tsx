import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

const EvaluationModerationPage = lazy(() =>
  import("./-moderation-page").then((module) => ({ default: module.EvaluationModerationPage })),
);

export const Route = createFileRoute("/evaluations/moderation")({
  component: EvaluationModerationRoute,
});

function EvaluationModerationRoute() {
  return (
    <Suspense fallback={<div className="bg-background flex-1" />}>
      <EvaluationModerationPage />
    </Suspense>
  );
}
