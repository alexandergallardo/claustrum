import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AppLayoutWrapper } from '@/components/app-layout-wrapper'
import {
  useUniversities,
  useCampuses,
  useAcademicUnits,
  useStudyPlans,
  useStudyPlanDetail,
  useUserStudyPlan,
} from '@/lib/hooks/use-queries'
import type { CatalogCampus, CatalogStudyPlan } from '@/lib/types'
import { PlanFilters } from '@/components/plan-estudios/plan-filters'
import { PlanBoard } from '@/components/plan-estudios/plan-board'
import { AlertTriangle } from 'lucide-react'

const MAIN_CAMPUS_CODES = new Set(['AL', 'CA', 'LM', 'SC', 'SJ'])

const curriculumSearchSchema = z.object({
  university: z.coerce.number().optional(),
  campus: z.coerce.number().optional(),
  career: z.coerce.number().optional(),
  plan: z.coerce.number().optional(),
})

import { z } from 'zod'

export const Route = createFileRoute('/app/curriculum/')({
  validateSearch: curriculumSearchSchema,
  component: PlanEstudiosPage,
})

function PlanEstudiosPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/app/curriculum' })

  const selectedUniversityId = search.university ?? null
  const selectedCampusId = search.campus ?? null
  const selectedAcademicUnitId = search.career ?? null
  const selectedPlanId = search.plan ?? null

  const { data: universities, isLoading: isLoadingUniversities } = useUniversities()
  const campusesQuery = useCampuses(selectedUniversityId)
  const academicUnitsQuery = useAcademicUnits(selectedCampusId)
  const plansQuery = useStudyPlans(selectedAcademicUnitId)

  const selectedPlanData = plansQuery.data?.find((p: CatalogStudyPlan) => p.id === selectedPlanId)
  const planDetailQuery = useStudyPlanDetail(selectedPlanId, selectedPlanData)
  const { data: userStudyPlan } = useUserStudyPlan()

  const campuses = campusesQuery.data ?? []
  const academicUnits = academicUnitsQuery.data ?? []
  const plans = plansQuery.data ?? []

  const mainCampuses = campuses.filter((c: CatalogCampus) => MAIN_CAMPUS_CODES.has(c.code) || c.id === selectedCampusId)

  useEffect(() => {
    if (!selectedUniversityId && !selectedCampusId && !selectedAcademicUnitId && !selectedPlanId && userStudyPlan) {
      navigate({
        to: '/app/curriculum/',
        search: {
          university: userStudyPlan.universityId ?? undefined,
          campus: userStudyPlan.campusId ?? undefined,
          career: userStudyPlan.academicUnitId ?? undefined,
          plan: userStudyPlan.studyPlanId ?? undefined,
        },
      })
    }
  }, [userStudyPlan, selectedUniversityId, selectedCampusId, selectedAcademicUnitId, selectedPlanId, navigate])

  const handleUniversityChange = useCallback((id: number | null) => {
    navigate({
      search: {
        university: id ?? undefined,
        campus: undefined,
        career: undefined,
        plan: undefined,
      },
    })
  }, [navigate])

  const handleCampusChange = useCallback((id: number | null) => {
    navigate({
      search: {
        ...search,
        campus: id ?? undefined,
        career: undefined,
        plan: undefined,
      },
    })
  }, [navigate, search])

  const handleAcademicUnitChange = useCallback((id: number | null) => {
    navigate({
      search: {
        ...search,
        career: id ?? undefined,
        plan: undefined,
      },
    })
  }, [navigate, search])

  const handlePlanChange = useCallback((id: number | null) => {
    navigate({
      search: {
        ...search,
        plan: id ?? undefined,
      },
    })
  }, [navigate, search])

  return (
    <AppLayoutWrapper>
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <div>
                <h1 className="text-2xl font-bold">Plan de estudios</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Visualiza la estructura y requisitos de tu carrera
                </p>
              </div>
            </div>

            <div className="px-4 lg:px-6">
              <PlanFilters
                universities={universities ?? []}
                campuses={mainCampuses}
                careerPrograms={academicUnits}
                plans={plans}
                selectedUniversityId={selectedUniversityId}
                selectedCampusId={selectedCampusId}
                selectedCareerProgramId={selectedAcademicUnitId}
                selectedPlanId={selectedPlanId}
                onUniversityChange={handleUniversityChange}
                onCampusChange={handleCampusChange}
                onCareerProgramChange={handleAcademicUnitChange}
                onPlanChange={handlePlanChange}
                isLoadingUniversities={isLoadingUniversities}
                isLoadingCampuses={campusesQuery.isFetching && campusesQuery.data?.length === 0}
                isLoadingCareerPrograms={academicUnitsQuery.isFetching && academicUnitsQuery.data?.length === 0}
                isLoadingPlans={plansQuery.isFetching && plansQuery.data?.length === 0}
              />
            </div>

            {planDetailQuery.isError && (
              <div className="px-4 lg:px-6">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Error al cargar el plan de estudios. Intenta de nuevo.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {selectedPlanId && planDetailQuery.isLoading && (
              <div className="px-4 lg:px-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-6 w-48" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              </div>
            )}

            {selectedPlanId && planDetailQuery.isSuccess && planDetailQuery.data && (
              <div className="px-4 lg:px-6 min-h-0 flex-1">
                <Card className="h-full min-h-0 overflow-auto py-0">
                  <PlanBoard planDetail={planDetailQuery.data} />
                </Card>
              </div>
            )}

            {!selectedPlanId && !planDetailQuery.isLoading && (
              <div className="px-4 lg:px-6">
                <Card className="flex-1 min-h-96 flex items-center justify-center">
                  <p className="text-muted-foreground">Selecciona una carrera para visualizar el plan de estudios</p>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayoutWrapper>
  )
}
