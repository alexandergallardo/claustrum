import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { z } from 'zod'
import { AppLayoutWrapper } from '@/components/app-layout-wrapper'
import Calendar from '@/components/calendar/calendar'
import CourseList from '@/components/course-list'
import { sessionToEvent } from '@/lib/calendar-utils'
import { startOfWeek, eachWeekOfInterval, addWeeks } from 'date-fns'
import { colorOptions } from '@/components/calendar/calendar-tailwind-classes'
import type { Mode, CalendarEvent } from '@/components/calendar/calendar-types'
import { Skeleton } from '@/components/ui/skeleton'
import { ScheduleFilters } from '@/components/schedule/schedule-filters'
import { ResizablePanel } from '@/components/resizable-panel'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  useUniversities,
  useCampuses,
  useAcademicUnits,
  useStudyPlans,
  useAcademicTerms,
  useScheduleCourses,
  useUserStudyPlan,
} from '@/lib/hooks/use-queries'

const MAIN_CAMPUS_CODES = new Set(['AL', 'CA', 'LM', 'SC', 'SJ'])

const scheduleSearchSchema = z.object({
  view: z.enum(['week', 'month', 'day']).optional(),
  university: z.coerce.number().optional(),
  campus: z.coerce.number().optional(),
  career: z.coerce.number().optional(),
  plan: z.coerce.number().optional(),
  term: z.coerce.number().optional(),
  otherCampuses: z.boolean().optional(),
})

export const Route = createFileRoute('/app/schedule/')({
  validateSearch: scheduleSearchSchema,
  component: SchedulePage,
})

const SEMESTER_START = new Date(2026, 1, 16)

function SchedulePage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/app/schedule' })

  const selectedUniversityId = search.university ?? null
  const selectedCampusId = search.campus ?? null
  const selectedCareerId = search.career ?? null
  const selectedPlanId = search.plan ?? null
  const selectedTermId = search.term ?? null

  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set())
  const mode = search.view ?? 'week'
  const [date, setDate] = useState(SEMESTER_START)

  const { data: universities, isLoading: isLoadingUniversities } = useUniversities()
  const campusesQuery = useCampuses(selectedUniversityId)
  const careersQuery = useAcademicUnits(selectedCampusId)
  const plansQuery = useStudyPlans(selectedCareerId)
  const termsQuery = useAcademicTerms(selectedCampusId)
  const coursesQuery = useScheduleCourses({
    termId: selectedTermId,
    campusId: selectedCampusId,
    careerId: selectedCareerId,
    includeOtherCampuses: search.otherCampuses ?? false,
  })
  const { data: userStudyPlan } = useUserStudyPlan()

  const campuses = campusesQuery.data ?? []
  const careers = careersQuery.data ?? []
  const plans = plansQuery.data ?? []
  const terms = termsQuery.data ?? []
  const courses = coursesQuery.data ?? []

  const mainCampuses = campuses.filter((c) => MAIN_CAMPUS_CODES.has(c.code) || c.id === selectedCampusId)

  useEffect(() => {
    if (userStudyPlan && !search.university && !search.campus && !search.career && !search.plan && !search.term) {
      navigate({
        to: '/app/schedule',
        search: {
          university: userStudyPlan.universityId ?? undefined,
          campus: userStudyPlan.campusId ?? undefined,
          career: userStudyPlan.academicUnitId ?? undefined,
          plan: userStudyPlan.studyPlanId ?? undefined,
        },
      })
    }
  }, [userStudyPlan, search, navigate])

  useEffect(() => {
    if (selectedCampusId && terms.length > 0 && !selectedTermId) {
      navigate({
        to: '/app/schedule',
        search: {
          ...search,
          term: terms[0].id,
        },
      })
    }
  }, [selectedCampusId, terms, selectedTermId, search, navigate])

  const handleViewChange = useCallback((newMode: Mode) => {
    navigate({
      to: '/app/schedule',
      search: {
        ...search,
        view: newMode,
      },
    })
  }, [navigate, search])

  const handleUniversityChange = useCallback((id: number | null) => {
    navigate({
      to: '/app/schedule',
      search: {
        ...search,
        university: id ?? undefined,
        campus: undefined,
        career: undefined,
        plan: undefined,
        term: undefined,
      },
    })
  }, [navigate, search])

  const handleCampusChange = useCallback((id: number | null) => {
    navigate({
      to: '/app/schedule',
      search: {
        ...search,
        campus: id ?? undefined,
        career: undefined,
        plan: undefined,
        term: undefined,
      },
    })
  }, [navigate, search])

  const handleCareerChange = useCallback((id: number | null) => {
    navigate({
      to: '/app/schedule',
      search: {
        ...search,
        career: id ?? undefined,
        plan: undefined,
        term: undefined,
      },
    })
  }, [navigate, search])

  const handlePlanChange = useCallback((id: number | null) => {
    navigate({
      to: '/app/schedule',
      search: {
        ...search,
        plan: id ?? undefined,
        term: undefined,
      },
    })
  }, [navigate, search])

  const handleTermChange = useCallback((id: number | null) => {
    navigate({
      to: '/app/schedule',
      search: {
        ...search,
        term: id ?? undefined,
      },
    })
  }, [navigate, search])

  const handleOtherCampusesChange = useCallback((checked: boolean) => {
    navigate({
      to: '/app/schedule',
      search: {
        ...search,
        otherCampuses: checked ?? undefined,
      },
    })
  }, [navigate, search])

  const courseColors = useMemo(() => {
    const map = new Map<string, string>()
    courses.forEach((course, index) => {
      const color = colorOptions[index % colorOptions.length].value
      map.set(course.course_code, color)
    })
    return map
  }, [courses])

  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    if (!courses) return []

    const events: CalendarEvent[] = []

    const semesterWeekStart = startOfWeek(SEMESTER_START, { weekStartsOn: 1 })
    const semesterEnd = addWeeks(semesterWeekStart, 16)
    const weeks = eachWeekOfInterval(
      { start: semesterWeekStart, end: semesterEnd },
      { weekStartsOn: 1 }
    )

    selectedGroups.forEach((groupId) => {
      const [courseCode, groupNumStr] = groupId.split('-')
      const groupNum = parseInt(groupNumStr, 10)

      const course = courses.find((c) => c.course_code === courseCode)
      if (!course) return
      if (!course.groups) return

      const group = (course.groups as any[]).find((g: any) => parseInt(g.group_code, 10) === groupNum)
      if (!group || !group.meetings) return

      const color = courseColors.get(courseCode) || 'blue'

      const sessions = group.meetings
      if (!sessions) return

      weeks.forEach((weekStart) => {
        sessions.forEach((session: any) => {
          try {
            const event = sessionToEvent(
              session,
              courseCode,
              course.course_name,
              groupNum,
              color,
              weekStart
            )
            events.push(event)
          } catch (err) {
            console.error('Error converting session to event:', err)
          }
        })
      })
    })

    return events
  }, [selectedGroups, courses, courseColors])

  const isLoadingFilters = isLoadingUniversities || campusesQuery.isLoading || careersQuery.isLoading || plansQuery.isLoading || termsQuery.isLoading
  const isInitialLoading = isLoadingFilters && !universities?.length

  if (isInitialLoading) {
    return (
      <AppLayoutWrapper>
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <Skeleton className="h-8 w-48" />
              </div>
              <div className="px-4 lg:px-6">
                <Skeleton className="h-12 w-full" />
              </div>
              <div className="px-4 lg:px-6">
                <div className="flex gap-4 h-[calc(100vh-16rem)]">
                  <div className="w-96 space-y-4">
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                  </div>
                  <div className="flex-1">
                    <Skeleton className="h-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppLayoutWrapper>
    )
  }

  if (coursesQuery.isError) {
    return (
      <AppLayoutWrapper>
        <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Error al cargar el horario</h2>
            <p className="text-muted-foreground">{coursesQuery.error instanceof Error ? coursesQuery.error.message : 'Error desconocido'}</p>
          </div>
        </div>
      </AppLayoutWrapper>
    )
  }

  return (
    <AppLayoutWrapper>
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <div>
                <h1 className="text-2xl font-bold">Horarios</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Visualiza y gestiona tus horarios de clases
                </p>
              </div>
            </div>

            <div className="px-4 lg:px-6">
              <ScheduleFilters
                universities={universities ?? []}
                campuses={mainCampuses}
                careers={careers}
                plans={plans}
                terms={terms}
                selectedUniversityId={selectedUniversityId}
                selectedCampusId={selectedCampusId}
                selectedCareerId={selectedCareerId}
                selectedPlanId={selectedPlanId}
                selectedTermId={selectedTermId}
                onUniversityChange={handleUniversityChange}
                onCampusChange={handleCampusChange}
                onCareerChange={handleCareerChange}
                onPlanChange={handlePlanChange}
                onTermChange={handleTermChange}
                isLoadingUniversities={isLoadingUniversities}
                isLoadingCampuses={campusesQuery.isFetching && campusesQuery.data?.length === 0}
                isLoadingCareers={careersQuery.isFetching && careersQuery.data?.length === 0}
                isLoadingPlans={plansQuery.isFetching && plansQuery.data?.length === 0}
                isLoadingTerms={termsQuery.isFetching && termsQuery.data?.length === 0}
              />
            </div>

            <div className="px-4 lg:px-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="otherCampuses"
                  checked={search.otherCampuses ?? false}
                  onCheckedChange={handleOtherCampusesChange}
                />
                <Label htmlFor="otherCampuses">Mostrar grupos de otras sedes</Label>
              </div>
            </div>

            {selectedTermId && !courses.length && !coursesQuery.isLoading && (
              <div className="px-4 lg:px-6">
                <div className="flex items-center justify-center h-[calc(100vh-24rem)]">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">No hay cursos disponibles</h2>
                    <p className="text-muted-foreground">
                      No se encontraron cursos para el período seleccionado
                    </p>
                  </div>
                </div>
              </div>
            )}

            {courses.length > 0 && (
              <div className="px-4 lg:px-6">
                <div className="h-[calc(100vh-16rem)] border rounded-lg overflow-hidden">
                  <ResizablePanel
                    leftContent={
                      <div className="h-full flex flex-col">
                        <div className="px-4 py-3 border-b bg-muted/30 shrink-0">
                          <h2 className="text-lg font-semibold">
                            {courses.length} curso{courses.length !== 1 ? 's' : ''} disponible{courses.length !== 1 ? 's' : ''}
                          </h2>
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <CourseList
                            courses={courses}
                            selectedGroups={selectedGroups}
                            onSelectionChange={setSelectedGroups}
                          />
                        </div>
                      </div>
                    }
                    rightContent={
                      <Calendar
                        events={calendarEvents}
                        setEvents={() => {}}
                        mode={mode}
                        setMode={handleViewChange}
                        date={date}
                        setDate={setDate}
                      />
                    }
                    initialLeftWidth={400}
                    minLeftWidth={320}
                    maxLeftWidth={600}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayoutWrapper>
  )
}
