import { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const EvaluationViewPage = lazy(() =>
  import("./-view-page").then((module) => ({ default: module.EvaluationViewPage })),
);

const viewSearchSchema = z.object({
  key: z.string().min(1),
  courseCode: z.string().min(1).optional(),
  evaluationType: z.enum(["parcial", "quiz", "final", "reposicion", "tarea", "proyecto", "otro"]).optional(),
  evaluationNumber: z.number().int().positive().optional(),
  customName: z.string().optional(),
});

export const Route = createFileRoute("/evaluations/view")({
  validateSearch: viewSearchSchema,
  component: EvaluationViewRoute,
});

function EvaluationViewRoute() {
  return (
    <Suspense fallback={<div className="flex-1 bg-background" />}>
      <EvaluationViewPage />
    </Suspense>
  );
}
