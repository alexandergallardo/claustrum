import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";
import { z } from "zod";

const CourseDetailPage = lazy(() =>
  import("./-course-detail-page").then((module) => ({ default: module.CourseDetailPage })),
);

const curriculumSearchSchema = z.object({
  university: z.coerce.number().optional(),
  campus: z.coerce.number().optional(),
  career: z.coerce.number().optional(),
  plan: z.coerce.number().optional(),
});

export const Route = createFileRoute("/curriculum/$courseId")({
  validateSearch: curriculumSearchSchema,
  component: CourseDetailRoute,
});

function CourseDetailRoute() {
  return (
    <Suspense fallback={<div className="bg-background flex-1" />}>
      <CourseDetailPage />
    </Suspense>
  );
}
