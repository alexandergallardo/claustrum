import { createFileRoute } from "@tanstack/react-router";
import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useTransition,
} from "react";
import { toJpeg, toPng } from "html-to-image";
import { z } from "zod";
import { toast } from "sonner";
import { AppLayoutWrapper } from "@/components/app-layout-wrapper";
import Calendar from "@/components/calendar/calendar";
import CourseList from "@/components/course-list";
import { getGroupId, sessionToEvent } from "@/lib/calendar-utils";
import { startOfWeek } from "date-fns";
import { colorOptions } from "@/components/calendar/calendar-tailwind-classes";
import type { Mode, CalendarEvent } from "@/components/calendar/calendar-types";
import type { ScheduleCourse, ScheduleGroup } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { ScheduleFilters } from "@/components/schedule/schedule-filters";
import { ResizablePanel } from "@/components/resizable-panel";
import {
  ScheduleZoomControls,
  SCHEDULE_DEFAULT_HOUR_HEIGHT,
} from "@/components/schedule/schedule-zoom-controls";
import {
  ScheduleExportDialog,
  type ScheduleExportOptions,
} from "@/components/schedule/schedule-export-dialog";
import {
  START_HOUR,
  END_HOUR,
} from "@/components/calendar/body/day/calendar-body-day-margin";
import {
  useUniversities,
  useCampuses,
  useAcademicUnits,
  useStudyPlans,
  useAcademicTerms,
  useScheduleCourses,
  useUserStudyPlan,
  useSuggestedAcademicTerm,
} from "@/lib/hooks/use-queries";

const MAIN_CAMPUS_CODES = new Set(["AL", "CA", "LM", "SC", "SJ"]);

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
  component: SchedulePage,
});

function SchedulePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const selectedUniversityId = search.university ?? null;
  const selectedCampusId = search.campus ?? null;
  const selectedCareerId = search.career ?? null;
  const selectedPlanId = search.plan ?? null;
  const selectedTermId = search.term ?? null;
  const showAllCourses = search.showAll ?? true;

  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const mode: Mode = "week";
  const [date] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [hourHeight, setHourHeight] = useState<number>(
    SCHEDULE_DEFAULT_HOUR_HEIGHT,
  );
  const [, startTransition] = useTransition();
  const totalHours = END_HOUR - START_HOUR + 1;
  const calendarHeight = totalHours * hourHeight + 33;
  const previousGroupsRef = useRef<string | undefined>(undefined);
  const calendarRef = useRef<HTMLDivElement>(null);

  const serializedGroups = useMemo(() => {
    if (!search.groups) return [];
    return search.groups
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }, [search.groups]);


  const { data: universities, isLoading: isLoadingUniversities } =
    useUniversities();
  const campusesQuery = useCampuses(selectedUniversityId);
  const careersQuery = useAcademicUnits(selectedCampusId);
  const plansQuery = useStudyPlans(selectedCareerId);
  const termsQuery = useAcademicTerms(selectedCampusId);
  const coursesQuery = useScheduleCourses({
    termId: selectedTermId,
    campusId: selectedCampusId,
    careerId: selectedCareerId,
    includeOtherCampuses: search.otherCampuses ?? false,
    showAllCourses: showAllCourses,
  });
  const { data: userStudyPlan } = useUserStudyPlan();
  const suggestedTermQuery = useSuggestedAcademicTerm(selectedPlanId);

  const campuses = campusesQuery.data ?? [];
  const campusById = useMemo(
    () => new Map(campuses.map((campus) => [campus.id, campus.name])),
    [campuses],
  );
  const careers = careersQuery.data ?? [];
  const plans = plansQuery.data ?? [];
  const terms = termsQuery.data ?? [];
  const courses = coursesQuery.data ?? [];

  const orderedCourses = useMemo(() => {
    return [...courses].sort((a, b) => {
      const levelA = a.level_number ?? 999;
      const levelB = b.level_number ?? 999;
      if (levelA !== levelB) return levelA - levelB;

      const sortA = a.sort_order ?? 999;
      const sortB = b.sort_order ?? 999;
      if (sortA !== sortB) return sortA - sortB;

      return a.course_code.localeCompare(b.course_code);
    });
  }, [courses]);

  const weekStart = useMemo(
    () => startOfWeek(date, { weekStartsOn: 1 }),
    [date],
  );

  const groupById = useMemo(() => {
    const map = new Map<
      string,
      {
        course: ScheduleCourse;
        group: ScheduleGroup;
        campusId: number | null;
      }
    >();

    orderedCourses.forEach((course) => {
      course.groups?.forEach((group) => {
        const groupId = getGroupId(
          course.course_code,
          parseInt(group.group_code, 10),
          group.campus_id,
        );
        map.set(groupId, {
          course,
          group,
          campusId: group.campus_id ?? null,
        });
      });
    });

    return map;
  }, [orderedCourses]);

  const mainCampuses = campuses.filter(
    (c) => MAIN_CAMPUS_CODES.has(c.code) || c.id === selectedCampusId,
  );

  useEffect(() => {
    if (
      userStudyPlan &&
      !search.university &&
      !search.campus &&
      !search.career &&
      !search.plan &&
      !search.term
    ) {
      navigate({
        to: "/app/schedule",
        search: {
          university: userStudyPlan.universityId ?? undefined,
          campus: userStudyPlan.campusId ?? undefined,
          career: userStudyPlan.academicUnitId ?? undefined,
          plan: userStudyPlan.studyPlanId ?? undefined,
        },
      });
    }
  }, [userStudyPlan, search, navigate]);

  useEffect(() => {
    if (selectedCampusId && terms.length > 0 && !selectedTermId) {
      let termId = terms[0].id;
      if (suggestedTermQuery.data && !search.term) {
        termId = suggestedTermQuery.data;
      }
      navigate({
        to: "/app/schedule",
        search: {
          ...search,
          term: termId,
        },
      });
    }
  }, [
    selectedCampusId,
    terms,
    selectedTermId,
    search,
    navigate,
    suggestedTermQuery.data,
  ]);

  useEffect(() => {
    const stored = localStorage.getItem("schedule-hour-height");
    if (stored) {
      const height = parseInt(stored, 10);
      if (!isNaN(height)) {
        setHourHeight(height);
      }
    }
  }, []);

  useEffect(() => {
    if (previousGroupsRef.current === search.groups) return;
    previousGroupsRef.current = search.groups;
    setSelectedGroups(new Set(serializedGroups));
  }, [search.groups, serializedGroups]);

  const updateSelectedGroups = useCallback(
    (nextGroups: Set<string>) => {
      setSelectedGroups(nextGroups);
      const nextGroupsValue = nextGroups.size
        ? Array.from(nextGroups).join(",")
        : undefined;
      if (nextGroupsValue === search.groups) return;
      startTransition(() => {
        navigate({
          to: "/app/schedule",
          search: {
            ...search,
            groups: nextGroupsValue,
          },
        });
      });
    },
    [navigate, search, startTransition]
  );

  const handleExport = useCallback(async (options: ScheduleExportOptions) => {
    const calendarElement = calendarRef.current;
    if (!calendarElement) {
      toast.error("No se pudo encontrar el elemento del calendario");
      return;
    }

    const exportTheme = options.transparent ? null : options.theme;
    if (exportTheme) {
      calendarElement.setAttribute("data-export-theme", exportTheme);
    }

    try {
      const extension = options.format === "jpeg" ? "jpg" : "png";
      const dateStamp = new Date().toISOString().slice(0, 10);
      const backgroundColor = options.transparent
        ? undefined
        : options.theme === "dark"
          ? "#0b0b0b"
          : "#ffffff";

      const dataUrl =
        options.format === "jpeg"
          ? await toJpeg(calendarElement, {
              quality: 0.95,
              backgroundColor,
              pixelRatio: 2,
            })
          : await toPng(calendarElement, {
              backgroundColor,
              pixelRatio: 2,
            });

      const link = document.createElement("a");
      link.download = `horario-${dateStamp}.${extension}`;
      link.href = dataUrl;
      link.click();

      toast.success("Horario exportado correctamente");
    } catch (error) {
      console.error("Error exporting schedule:", error);
      toast.error("Error al exportar el horario");
    } finally {
      if (exportTheme) {
        calendarElement.removeAttribute("data-export-theme");
      }
    }
  }, []);

  const handleUniversityChange = useCallback(
    (id: number | null) => {
      navigate({
        to: "/app/schedule",
        search: {
          ...search,
          university: id ?? undefined,
          campus: undefined,
          career: undefined,
          plan: undefined,
          term: undefined,
        },
      });
    },
    [navigate, search],
  );

  const handleCampusChange = useCallback(
    (id: number | null) => {
      navigate({
        to: "/app/schedule",
        search: {
          ...search,
          campus: id ?? undefined,
          career: undefined,
          plan: undefined,
          term: undefined,
        },
      });
    },
    [navigate, search],
  );

  const handleCareerChange = useCallback(
    (id: number | null) => {
      navigate({
        to: "/app/schedule",
        search: {
          ...search,
          career: id ?? undefined,
          plan: undefined,
          term: undefined,
        },
      });
    },
    [navigate, search],
  );

  const handlePlanChange = useCallback(
    (id: number | null) => {
      navigate({
        to: "/app/schedule",
        search: {
          ...search,
          plan: id ?? undefined,
          term: undefined,
        },
      });
    },
    [navigate, search],
  );

  const handleTermChange = useCallback(
    (id: number | null) => {
      navigate({
        to: "/app/schedule",
        search: {
          ...search,
          term: id ?? undefined,
        },
      });
    },
    [navigate, search],
  );

  const handleOtherCampusesChange = useCallback(
    (checked: boolean) => {
      navigate({
        to: "/app/schedule",
        search: {
          ...search,
          otherCampuses: checked ?? undefined,
        },
      });
    },
    [navigate, search],
  );

  const handleShowAllChange = useCallback(
    (checked: boolean) => {
      navigate({
        to: "/app/schedule",
        search: {
          ...search,
          showAll: checked ?? undefined,
        },
      });
    },
    [navigate, search],
  );

  const courseColors = useMemo(() => {
    const map = new Map<string, string>();
    orderedCourses.forEach((course, index) => {
      const color = colorOptions[index % colorOptions.length].value;
      map.set(course.course_code, color);
    });
    return map;
  }, [orderedCourses]);

  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    if (!orderedCourses) return [];

    const events: CalendarEvent[] = [];

    selectedGroups.forEach((selectedGroupId) => {
      const groupData = groupById.get(selectedGroupId);
      if (!groupData?.group.meetings) return;

      const course = groupData.course;
      const group = groupData.group;
      const courseCode = course.course_code;
      const color = courseColors.get(courseCode) || "blue";
      const campusName = groupData.campusId
        ? (campusById.get(groupData.campusId) ?? null)
        : null;

      const sessions = group.meetings;
      if (!sessions) return;

      sessions.forEach((session: any) => {
        try {
          const event = sessionToEvent({
            session,
            courseId: courseCode,
            courseCode,
            courseName: course.course_name,
            groupCode: group.group_code,
            groupId: selectedGroupId,
            groupType: group.group_type ?? null,
            professors: group.professors ?? null,
            classroom: session.classroom ?? null,
            campusName,
            color,
            weekStart,
          });
          events.push(event);
        } catch (err) {
          console.error("Error converting session to event:", err);
        }
      });
    });

    return events;
  }, [selectedGroups, courseColors, weekStart, campusById, groupById]);

  const handleRemoveEvent = useCallback(
    (event: CalendarEvent) => {
      const next = new Set(selectedGroups);
      next.delete(event.groupId);
      updateSelectedGroups(next);
    },
    [selectedGroups, updateSelectedGroups]
  );

  const isLoadingFilters =
    isLoadingUniversities ||
    campusesQuery.isLoading ||
    careersQuery.isLoading ||
    plansQuery.isLoading ||
    termsQuery.isLoading;
  const isInitialLoading = isLoadingFilters && !universities?.length;

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
    );
  }

  if (coursesQuery.isError) {
    return (
      <AppLayoutWrapper>
        <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">
              Error al cargar el horario
            </h2>
            <p className="text-muted-foreground">
              {coursesQuery.error instanceof Error
                ? coursesQuery.error.message
                : "Error desconocido"}
            </p>
          </div>
        </div>
      </AppLayoutWrapper>
    );
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
                isLoadingCampuses={
                  campusesQuery.isFetching && campusesQuery.data?.length === 0
                }
                isLoadingCareers={
                  careersQuery.isFetching && careersQuery.data?.length === 0
                }
                isLoadingPlans={
                  plansQuery.isFetching && plansQuery.data?.length === 0
                }
                isLoadingTerms={
                  termsQuery.isFetching && termsQuery.data?.length === 0
                }
                showAll={search.showAll ?? true}
                onShowAllChange={handleShowAllChange}
                showOtherCampuses={search.otherCampuses ?? false}
                onShowOtherCampusesChange={handleOtherCampusesChange}
              />
            </div>

            {selectedTermId &&
              !orderedCourses.length &&
              !coursesQuery.isLoading && (
                <div className="px-4 lg:px-6">
                  <div className="flex items-center justify-center h-[calc(100vh-24rem)]">
                    <div className="text-center">
                      <h2 className="text-2xl font-bold mb-2">
                        No hay cursos disponibles
                      </h2>
                      <p className="text-muted-foreground">
                        No se encontraron cursos para el período seleccionado
                      </p>
                    </div>
                  </div>
                </div>
              )}

            {orderedCourses.length > 0 && (
              <div className="px-4 lg:px-6">
                <div
                  className="border rounded-lg shrink-0"
                  style={{ height: calendarHeight }}
                >
                  <ResizablePanel
                    leftContent={
                      <div className="h-full flex flex-col">
                        <div className="px-4 py-3 border-b bg-muted/30 shrink-0">
                          <h2 className="text-lg font-semibold">
                            {orderedCourses.length} curso
                            {orderedCourses.length !== 1 ? "s" : ""} disponible
                            {orderedCourses.length !== 1 ? "s" : ""}
                          </h2>
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <CourseList
                            courses={orderedCourses}
                            selectedGroups={selectedGroups}
                            onSelectionChange={updateSelectedGroups}
                            campusById={campusById}
                            showCampus={search.otherCampuses ?? false}
                          />
                        </div>
                      </div>
                    }
                    rightContent={
                      <div className="relative h-full">
                        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
                          <ScheduleZoomControls
                            hourHeight={hourHeight}
                            setHourHeight={setHourHeight}
                            isFloating={false}
                          />
                          <ScheduleExportDialog onExport={handleExport} />
                        </div>
                        <div ref={calendarRef} className="h-full">
                          <Calendar
                            events={calendarEvents}
                            setEvents={() => {}}
                            mode={mode}
                            setMode={() => {}}
                            date={date}
                            setDate={() => {}}
                            onRemoveEvent={handleRemoveEvent}
                            hourHeight={hourHeight}
                            setHourHeight={setHourHeight}
                          />
                        </div>
                      </div>
                    }
                    initialLeftWidth={400}
                    minLeftWidth={326}
                    maxLeftWidth={600}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayoutWrapper>
  );
}
