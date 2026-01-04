import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useEffect } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { AppLayoutWrapper } from '@/components/app-layout-wrapper'
import {
  getUniversities,
  getCampuses,
  getCareerProgramsForCampus,
  getStudyPlansForCareerProgram,
  getStudyPlanCourses,
  getStudyPlanCourseRelations,
  getUserStudyPlan,
} from '@/lib/api'
import type { StudyPeriod, StudyPlanDetail, CatalogStudyPlan, CatalogCampus, CatalogCareerProgram } from '@/lib/types'
import { PlanFilters } from '@/components/plan-estudios/plan-filters'
import { PlanBoard } from '@/components/plan-estudios/plan-board'
import { AlertTriangle } from 'lucide-react'

const MAIN_CAMPUS_CODES = new Set(['AL', 'CA', 'LM', 'SC', 'SJ'])

export const Route = createFileRoute('/app/curriculum/')({
  component: PlanEstudiosPage,
})

function PlanEstudiosPage() {
  const [selectedUniversityId, setSelectedUniversityId] = useState<number | null>(null)
  const [selectedCampusId, setSelectedCampusId] = useState<number | null>(null)
  const [selectedCareerProgramId, setSelectedCareerProgramId] = useState<number | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [autoFilledFromUser, setAutoFilledFromUser] = useState(false)

  // State for universities
  const [universities, setUniversities] = useState<any[]>([])
  const [universitiesLoading, setUniversitiesLoading] = useState(true)

  // State for campuses
  const [campuses, setCampuses] = useState<CatalogCampus[]>([])
  const [campusesLoading, setCampusesLoading] = useState(false)

  // State for career programs (Carreras)
  const [careerPrograms, setCareerPrograms] = useState<CatalogCareerProgram[]>([])
  const [careerProgramsLoading, setCareerProgramsLoading] = useState(false)

  // State for plans
  const [plans, setPlans] = useState<any[]>([])
  const [plansLoading, setPlansLoading] = useState(false)

  // State for plan detail
  const [planDetail, setPlanDetail] = useState<StudyPlanDetail | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)

  // State for user study plan
  const [userStudyPlan, setUserStudyPlan] = useState<any>(null)

  // Load user's study plan on mount
  useEffect(() => {
    const loadUserStudyPlan = async () => {
      try {
        const data = await getUserStudyPlan()
        setUserStudyPlan(data)
      } catch (error) {
        console.error('Error loading user study plan:', error)
      }
    }
    loadUserStudyPlan()
  }, [])

  // Load universities on mount
  useEffect(() => {
    const loadUniversities = async () => {
      try {
        setUniversitiesLoading(true)
        const data = await getUniversities()
        setUniversities(data)
      } catch (error) {
        console.error('Error loading universities:', error)
      } finally {
        setUniversitiesLoading(false)
      }
    }
    loadUniversities()
  }, [])

  // Load campuses when university changes
  useEffect(() => {
    if (!selectedUniversityId) {
      setCampuses([])
      return
    }

    const loadCampuses = async () => {
      try {
        setCampusesLoading(true)
        const data = await getCampuses(selectedUniversityId)
        setCampuses(data)
      } catch (error) {
        console.error('Error loading campuses:', error)
      } finally {
        setCampusesLoading(false)
      }
    }
    loadCampuses()
  }, [selectedUniversityId])

  // Load career programs when campus changes
  useEffect(() => {
    if (!selectedCampusId) {
      setCareerPrograms([])
      return
    }

    const loadCareerPrograms = async () => {
      try {
        setCareerProgramsLoading(true)
        const data = await getCareerProgramsForCampus(selectedCampusId)
        setCareerPrograms(data)
      } catch (error) {
        console.error('Error loading career programs:', error)
      } finally {
        setCareerProgramsLoading(false)
      }
    }
    loadCareerPrograms()
  }, [selectedCampusId])

  // Load plans when career program changes
  useEffect(() => {
    if (!selectedCareerProgramId) {
      setPlans([])
      return
    }

    const loadPlans = async () => {
      try {
        setPlansLoading(true)
        const data = await getStudyPlansForCareerProgram(selectedCareerProgramId)
        setPlans(data)
      } catch (error) {
        console.error('Error loading plans:', error)
      } finally {
        setPlansLoading(false)
      }
    }
    loadPlans()
  }, [selectedCareerProgramId])

  // Load plan detail when plan changes
  useEffect(() => {
    if (!selectedPlanId) {
      setPlanDetail(null)
      return
    }

    const loadPlanDetail = async () => {
      try {
        setPlanLoading(true)
        setPlanError(null)
        const [courses, relations] = await Promise.all([
          getStudyPlanCourses(selectedPlanId),
          getStudyPlanCourseRelations(selectedPlanId),
        ])

        // NOTE: In `course_relation`, `from_course_id` is the dependent course and `to_course_id` is the required course.
        // So for a given course X, its prerequisites/corequisites are stored where `from_course_id = X`.
        const courseRelations = new Map<number, { prerequisites: number[]; corequisites: number[] }>()
        for (const r of relations) {
          if (r.relationType !== 'PREREQUISITE' && r.relationType !== 'COREQUISITE') continue
          const existing = courseRelations.get(r.fromCourseId) ?? { prerequisites: [], corequisites: [] }
          if (r.relationType === 'PREREQUISITE') {
            existing.prerequisites.push(r.toCourseId)
          } else {
            existing.corequisites.push(r.toCourseId)
          }
          courseRelations.set(r.fromCourseId, existing)
        }

        // Group courses by levelNumber (period/semester)
        const periods = new Map<number | null, typeof courses.courses>()
        for (const course of courses.courses) {
          const level = course.levelNumber ?? 0
          if (!periods.has(level)) {
            periods.set(level, [])
          }
          periods.get(level)!.push(course)
        }

        const periodArray: StudyPeriod[] = Array.from(periods.entries())
          .sort(([a], [b]) => (a ?? 0) - (b ?? 0))
          .map(([levelNumber, courses]) => ({
            levelNumber,
            courses,
          }))

        const selectedPlanData = plans.find((p: CatalogStudyPlan) => p.id === selectedPlanId)
        setPlanDetail({
          plan: selectedPlanData || ({} as CatalogStudyPlan),
          periods: periodArray,
          courseRelations,
        })
      } catch (error) {
        console.error('Error loading plan detail:', error)
        setPlanError('Error al cargar el plan de estudios. Intenta de nuevo.')
      } finally {
        setPlanLoading(false)
      }
    }
    loadPlanDetail()
  }, [selectedPlanId, plans])

  // Handle cascading resets
  const handleUniversityChange = useCallback((id: number | null) => {
    setSelectedUniversityId(id)
    setSelectedCampusId(null)
    setSelectedCareerProgramId(null)
    setSelectedPlanId(null)
  }, [])

  const handleCampusChange = useCallback((id: number | null) => {
    setSelectedCampusId(id)
    setSelectedCareerProgramId(null)
    setSelectedPlanId(null)
  }, [])

  const handleCareerProgramChange = useCallback((id: number | null) => {
    setSelectedCareerProgramId(id)
    setSelectedPlanId(null)
  }, [])

  const handlePlanChange = useCallback((id: number | null) => {
    setSelectedPlanId(id)
  }, [])

  // Auto-fill user's study plan data when loaded
  useEffect(() => {
    if (userStudyPlan && !autoFilledFromUser && selectedPlanId === null) {
      setSelectedUniversityId(userStudyPlan.universityId)
      setSelectedCampusId(userStudyPlan.campusId)
      setSelectedCareerProgramId(userStudyPlan.careerProgramId)
      setSelectedPlanId(userStudyPlan.studyPlanId)
      setAutoFilledFromUser(true)
    }
  }, [userStudyPlan, autoFilledFromUser, selectedPlanId])

  const mainCampuses = campuses.filter((c) => MAIN_CAMPUS_CODES.has(c.code) || c.id === selectedCampusId)

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
                universities={universities}
                campuses={mainCampuses}
                careerPrograms={careerPrograms}
                plans={plans}
                selectedUniversityId={selectedUniversityId}
                selectedCampusId={selectedCampusId}
                selectedCareerProgramId={selectedCareerProgramId}
                selectedPlanId={selectedPlanId}
                onUniversityChange={handleUniversityChange}
                onCampusChange={handleCampusChange}
                onCareerProgramChange={handleCareerProgramChange}
                onPlanChange={handlePlanChange}
                isLoadingCareerPrograms={careerProgramsLoading}
                isLoadingPlans={plansLoading}
                isLoadingUniversities={universitiesLoading}
                isLoadingCampuses={campusesLoading}
              />
            </div>

            {planError && (
              <div className="px-4 lg:px-6">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Error al cargar el plan de estudios. Intenta de nuevo.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {selectedPlanId && planLoading && (
              <div className="px-4 lg:px-6 space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-96 w-full" />
              </div>
            )}

            {selectedPlanId && !planLoading && planDetail && (
              <div className="px-4 lg:px-6 min-h-0 flex-1">
                <Card className="h-full min-h-0 overflow-auto">
                  <PlanBoard planDetail={planDetail} />
                </Card>
              </div>
            )}

            {!selectedPlanId && (
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
