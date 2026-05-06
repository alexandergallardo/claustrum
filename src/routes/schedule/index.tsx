import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";
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
  loadSchedule: z.coerce.number().optional(),
});

export const Route = createFileRoute("/schedule/")({
  validateSearch: scheduleSearchSchema,
  component: ScheduleRoute,
});

function ScheduleRoute() {
  return (
    <Suspense fallback={<div className="bg-background flex-1" />}>
      <SchedulePage />
    </Suspense>
  );
}
