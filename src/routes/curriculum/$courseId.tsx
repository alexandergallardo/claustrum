import { Suspense, lazy } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

const CourseDetailPage = lazy(() =>
  import("./-course-detail-page").then((module) => ({ default: module.CourseDetailPage })),
)

const curriculumSearchSchema = z.object({
  university: z.coerce.number().optional(),
  campus: z.coerce.number().optional(),
  career: z.coerce.number().optional(),
  plan: z.coerce.number().optional(),
})

export const Route = createFileRoute("/curriculum/$courseId")({
  validateSearch: curriculumSearchSchema,
  component: CourseDetailRoute,
})

function CourseDetailRoute() {
  return (
    <Suspense fallback={<div className="flex-1 bg-background" />}>
      <CourseDetailPage />
    </Suspense>
  )
}
