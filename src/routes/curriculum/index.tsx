import { Suspense, lazy } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const CurriculumPage = lazy(() =>
  import('./-curriculum-page').then((module) => ({ default: module.CurriculumPage })),
)

const curriculumSearchSchema = z.object({
  university: z.coerce.number().optional(),
  campus: z.coerce.number().optional(),
  career: z.coerce.number().optional(),
  plan: z.coerce.number().optional(),
})

export const Route = createFileRoute('/curriculum/')({
  validateSearch: curriculumSearchSchema,
  component: CurriculumRoute,
})

function CurriculumRoute() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-background" />}>
      <CurriculumPage />
    </Suspense>
  )
}
