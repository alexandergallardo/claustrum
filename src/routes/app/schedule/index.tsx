import { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const SchedulePage = lazy(() =>
  import("./-schedule-page").then((module) => ({ default: module.SchedulePage })),
);

const scheduleSearchSchema = z.object({
  view: z.enum(["week", "month", "day"]).optional(),
  university: z.coerce.number().optional(),
  campus: z.coerce.number().optional(),
  career: z.coerce.number().optional(),
  plan: z.coerce.number().optional(),
  term: z.coerce.number().optional(),
  otherCampuses: z.boolean().optional(),
  showAll: z.boolean().optional(),
  groups: z.string().optional(),
});

export const Route = createFileRoute("/app/schedule/")({
  validateSearch: scheduleSearchSchema,
  component: ScheduleRoute,
});

function ScheduleRoute() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-background" />}>
      <SchedulePage />
    </Suspense>
  );
}
