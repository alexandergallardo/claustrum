import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Suspense,
  lazy,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useTransition,
  type CSSProperties,
} from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { ChevronDown, User } from "lucide-react";
import CourseList from "@/components/course-list";
import { getGroupId, sessionToEvent } from "@/lib/calendar-utils";
import { buildScheduleIcs } from "@/lib/calendar/ics";
import { startOfWeek } from "date-fns";
import { colorOptions } from "@/components/calendar/calendar-tailwind-classes";
import type { Mode, CalendarEvent } from "@/components/calendar/calendar-types";
import type { ScheduleCourse, ScheduleGroup } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { ScheduleFilters } from "@/components/schedule/schedule-filters";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  ScheduleZoomControls,
  SCHEDULE_DEFAULT_HOUR_HEIGHT,
} from "@/components/schedule/schedule-zoom-controls";
import {
  ScheduleExportDialog,
  type ScheduleExportOptions,
  type ScheduleExportTheme,
} from "@/components/schedule/schedule-export-dialog";
import {
  START_HOUR,
  END_HOUR,
} from "@/components/calendar/body/day/calendar-body-day-margin";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useAuthUser,
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
const SHOW_ALL_STORAGE_KEY = "schedule-show-all";
const SHOW_OTHER_CAMPUSES_STORAGE_KEY = "schedule-show-other-campuses";
const Calendar = lazy(() => import("@/components/calendar/calendar"));

// Export constants - fixed, independent of user zoom/viewport
const EXPORT_HOUR_HEIGHT = 64;
const EXPORT_DAY_WIDTH = 150;
const EXPORT_MARGIN_WIDTH = 48;
const EXPORT_WEEK_DAYS = 6;
const EXPORT_HEADER_HEIGHT = 33;
const TOTAL_HOURS = END_HOUR - START_HOUR + 1;
const EXPORT_IMAGE_WIDTH = EXPORT_MARGIN_WIDTH + EXPORT_DAY_WIDTH * EXPORT_WEEK_DAYS;
const EXPORT_IMAGE_HEIGHT = EXPORT_HEADER_HEIGHT + TOTAL_HOURS * EXPORT_HOUR_HEIGHT;

const EXPORT_EVENT_COLORS = {
  light: {
    blue: ["rgb(219 234 254)", "rgb(191 219 254)", "rgb(147 197 253)", "rgb(30 58 138)"],
    emerald: ["rgb(209 250 229)", "rgb(167 243 208)", "rgb(110 231 183)", "rgb(6 95 70)"],
    yellow: ["rgb(254 249 195)", "rgb(254 240 138)", "rgb(253 224 71)", "rgb(113 63 18)"],
    red: ["rgb(254 226 226)", "rgb(254 202 202)", "rgb(252 165 165)", "rgb(127 29 29)"],
    orange: ["rgb(255 237 213)", "rgb(254 215 170)", "rgb(253 186 116)", "rgb(124 45 18)"],
    fuchsia: ["rgb(250 232 255)", "rgb(245 208 254)", "rgb(240 171 252)", "rgb(112 26 117)"],
    violet: ["rgb(237 233 254)", "rgb(221 214 254)", "rgb(196 181 253)", "rgb(76 29 149)"],
    slate: ["rgb(241 245 249)", "rgb(226 232 240)", "rgb(203 213 225)", "rgb(15 23 42)"],
  },
  dark: {
    blue: ["rgb(23 37 84)", "rgb(30 58 138)", "rgb(29 78 216)", "rgb(219 234 254)"],
    emerald: ["rgb(2 44 34)", "rgb(6 78 59)", "rgb(4 120 87)", "rgb(209 250 229)"],
    yellow: ["rgb(66 32 6)", "rgb(113 63 18)", "rgb(161 98 7)", "rgb(254 249 195)"],
    red: ["rgb(69 10 10)", "rgb(127 29 29)", "rgb(185 28 28)", "rgb(254 226 226)"],
    orange: ["rgb(67 20 7)", "rgb(124 45 18)", "rgb(194 65 12)", "rgb(255 237 213)"],
    fuchsia: ["rgb(74 4 78)", "rgb(112 26 117)", "rgb(162 28 175)", "rgb(250 232 255)"],
    violet: ["rgb(46 16 101)", "rgb(76 29 149)", "rgb(109 40 217)", "rgb(237 233 254)"],
    slate: ["rgb(15 23 42)", "rgb(30 41 59)", "rgb(51 65 85)", "rgb(241 245 249)"],
  },
} as const;

function applyExportEventColors(
  root: HTMLElement,
  theme: ScheduleExportTheme,
) {
  const elements = root.querySelectorAll<HTMLElement>("[data-schedule-event-color]");
  elements.forEach((element) => {
    const color = element.dataset.scheduleEventColor as keyof typeof EXPORT_EVENT_COLORS.light;
    const [bg, hover, border, text] = EXPORT_EVENT_COLORS[theme][color] ?? EXPORT_EVENT_COLORS[theme].blue;
    element.style.setProperty("--schedule-event-bg", bg);
    element.style.setProperty("--schedule-event-hover", hover);
    element.style.setProperty("--schedule-event-border", border);
    element.style.setProperty("--schedule-event-text", text);
    element.style.backgroundColor = bg;
    element.style.borderColor = border;
    element.style.color = text;
  });

  return () => {
    elements.forEach((element) => {
      element.style.removeProperty("--schedule-event-bg");
      element.style.removeProperty("--schedule-event-hover");
      element.style.removeProperty("--schedule-event-border");
      element.style.removeProperty("--schedule-event-text");
      element.style.removeProperty("background-color");
      element.style.removeProperty("border-color");
      element.style.removeProperty("color");
    });
  };
}

export function SchedulePage() {
  const isMobile = useIsMobile();
  const search = useSearch({ from: "/schedule/" });
  const navigate = useNavigate({ from: "/schedule/" });

  const selectedUniversityId = search.university ?? null;
  const selectedCampusId = search.campus ?? null;
  const selectedCareerId = search.career ?? null;
  const selectedPlanId = search.plan ?? null;
  const selectedTermId = search.term ?? null;
  const [isUsingProfileDefaults, setIsUsingProfileDefaults] = useState(
    () =>
      !search.university &&
      !search.campus &&
      !search.career &&
      !search.plan &&
      !search.term,
  );
  const [storedShowAll, setStoredShowAll] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(SHOW_ALL_STORAGE_KEY);
    if (stored === null) return true;
    return stored === "true";
  });
  const [storedShowOtherCampuses, setStoredShowOtherCampuses] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(SHOW_OTHER_CAMPUSES_STORAGE_KEY);
    if (stored === null) return false;
    return stored === "true";
  });
  const showAllCourses = search.showAll ?? storedShowAll;
  const showOtherCampuses = search.otherCampuses ?? storedShowOtherCampuses;

  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const mode: Mode = "week";
  const [date] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [isCourseListOpen, setIsCourseListOpen] = useState(true);
  const [hourHeight, setHourHeight] = useState<number>(
    SCHEDULE_DEFAULT_HOUR_HEIGHT,
  );
  const [currentExportTheme, setCurrentExportTheme] =
    useState<ScheduleExportTheme>("light");
  const [, startTransition] = useTransition();
  const totalHours = END_HOUR - START_HOUR + 1;
  const calendarHeight = totalHours * hourHeight + 33;
  const previousGroupsRef = useRef<string | undefined>(undefined);
  const calendarRef = useRef<HTMLDivElement>(null);
  const exportCalendarRef = useRef<HTMLDivElement>(null);

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
  const { data: authUser, isLoading: isAuthLoading } = useAuthUser();
  const isAuthenticated = !!authUser;
  const effectiveShowAllCourses = isAuthenticated ? showAllCourses : true;
  const coursesQuery = useScheduleCourses({
    termId: selectedTermId,
    campusId: selectedCampusId,
    careerId: selectedCareerId,
    planId: selectedPlanId,
    includeOtherCampuses: showOtherCampuses,
    showAllCourses: effectiveShowAllCourses,
    userId: authUser?.id ?? null,
    isAuthReady: !isAuthLoading,
  });
  const { data: userStudyPlan } = useUserStudyPlan(
    authUser?.id ?? null,
    !!authUser?.id && !isAuthLoading,
  );
  const suggestedTermQuery = useSuggestedAcademicTerm(
    selectedPlanId,
    !!selectedPlanId && !selectedTermId,
  );

  const campuses = campusesQuery.data ?? [];
  const campusById = useMemo(
    () => new Map(campuses.map((campus) => [campus.id, campus.name])),
    [campuses],
  );
  const careers = careersQuery.data ?? [];
  const plans = plansQuery.data ?? [];
  const terms = termsQuery.data ?? [];
  const selectedTerm = useMemo(
    () => terms.find((term) => term.id === selectedTermId) ?? null,
    [selectedTermId, terms],
  );
  const courses = useMemo(() => coursesQuery.data ?? [], [coursesQuery.data]);

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
        const campusId = group.campus_id ?? course.campus_id ?? null;
        const groupId = getGroupId(
          course.course_code,
          group.group_code,
        );
        map.set(groupId, {
          course,
          group,
          campusId,
        });
      });
    });

    return map;
  }, [orderedCourses]);

  const mainCampuses = campuses.filter(
    (c) => MAIN_CAMPUS_CODES.has(c.code) || c.id === selectedCampusId,
  );

  useEffect(() => {
    if (!isLoadingUniversities && universities?.length === 1 && !selectedUniversityId) {
      navigate({
        to: "/schedule",
        search: {
          ...search,
          university: universities[0].id,
        },
      });
    }
  }, [isLoadingUniversities, universities, selectedUniversityId, navigate, search]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!userStudyPlan || !isUsingProfileDefaults) return;
    if (
      search.university === userStudyPlan.universityId &&
      search.campus === userStudyPlan.campusId &&
      search.career === userStudyPlan.academicUnitId &&
      search.plan === userStudyPlan.studyPlanId
    ) {
      return;
    }
    if (
      userStudyPlan.universityId ||
      userStudyPlan.campusId ||
      userStudyPlan.academicUnitId ||
      userStudyPlan.studyPlanId
    ) {
      navigate({
        to: "/schedule",
        search: {
          university: userStudyPlan.universityId ?? undefined,
          campus: userStudyPlan.campusId ?? undefined,
          career: userStudyPlan.academicUnitId ?? undefined,
          plan: userStudyPlan.studyPlanId ?? undefined,
        },
      });
    }
  }, [isAuthenticated, isUsingProfileDefaults, navigate, search, userStudyPlan]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!userStudyPlan) return;
    const hasSearch =
      !!search.university ||
      !!search.campus ||
      !!search.career ||
      !!search.plan ||
      !!search.term;
    if (!hasSearch) {
      setIsUsingProfileDefaults(true);
      return;
    }
    const matchesProfile =
      search.university === userStudyPlan.universityId &&
      search.campus === userStudyPlan.campusId &&
      search.career === userStudyPlan.academicUnitId &&
      search.plan === userStudyPlan.studyPlanId;
    setIsUsingProfileDefaults(matchesProfile);
  }, [isAuthenticated, search, userStudyPlan]);

  useEffect(() => {
    if (isAuthenticated) return;
    setIsUsingProfileDefaults(false);
  }, [isAuthenticated]);

  useEffect(() => {
    if (
      selectedCampusId &&
      terms.length > 0 &&
      !selectedTermId &&
      suggestedTermQuery.isSuccess &&
      suggestedTermQuery.data
    ) {
      navigate({
        to: "/schedule",
        search: {
          ...search,
          term: suggestedTermQuery.data,
        },
      });
    } else if (
      selectedCampusId &&
      terms.length > 0 &&
      !selectedTermId &&
      suggestedTermQuery.isSuccess &&
      !suggestedTermQuery.data
    ) {
      navigate({
        to: "/schedule",
        search: {
          ...search,
          term: terms[0].id,
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
    suggestedTermQuery.isSuccess,
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (search.showAll === undefined) return;
    if (!isAuthenticated) return;
    localStorage.setItem(SHOW_ALL_STORAGE_KEY, String(search.showAll));
    setStoredShowAll(search.showAll);
  }, [isAuthenticated, search.showAll]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (search.otherCampuses === undefined) return;
    localStorage.setItem(
      SHOW_OTHER_CAMPUSES_STORAGE_KEY,
      String(search.otherCampuses),
    );
    setStoredShowOtherCampuses(search.otherCampuses);
  }, [search.otherCampuses]);

  const updateSelectedGroups = useCallback(
    (nextGroups: Set<string>) => {
      setSelectedGroups(nextGroups);
      const nextGroupsValue = nextGroups.size
        ? Array.from(nextGroups).join(",")
        : undefined;
      if (nextGroupsValue === search.groups) return;
      startTransition(() => {
        navigate({
          to: "/schedule",
          search: {
            ...search,
            groups: nextGroupsValue,
          },
          resetScroll: false,
        });
      });
    },
    [navigate, search, startTransition]
  );

  const handleUniversityChange = useCallback(
    (id: number | null) => {
      setIsUsingProfileDefaults(false);
      navigate({
        to: "/schedule",
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
      setIsUsingProfileDefaults(false);
      navigate({
        to: "/schedule",
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
      setIsUsingProfileDefaults(false);
      navigate({
        to: "/schedule",
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
      setIsUsingProfileDefaults(false);
      navigate({
        to: "/schedule",
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
      setIsUsingProfileDefaults(false);
      navigate({
        to: "/schedule",
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
        to: "/schedule",
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
      if (!isAuthenticated) return;
      navigate({
        to: "/schedule",
        search: {
          ...search,
          showAll: checked ?? undefined,
        },
      });
    },
    [isAuthenticated, navigate, search],
  );

  const handleUseProfileDefaults = useCallback(() => {
    if (!userStudyPlan) return;
    setIsUsingProfileDefaults(true);
    navigate({
      to: "/schedule",
      search: {
        ...search,
        university: userStudyPlan.universityId ?? undefined,
        campus: userStudyPlan.campusId ?? undefined,
        career: userStudyPlan.academicUnitId ?? undefined,
        plan: userStudyPlan.studyPlanId ?? undefined,
        term: search.term ?? undefined,
      },
    });
  }, [navigate, search, userStudyPlan]);

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

  const handleExport = useCallback(async (options: ScheduleExportOptions) => {
    if (options.format === "ics") {
      if (!calendarEvents.length) {
        toast.error("No hay clases seleccionadas para exportar");
        return;
      }

      try {
        const ics = buildScheduleIcs({
          events: calendarEvents,
          term: selectedTerm,
        });
        const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const dateStamp = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `horario-${dateStamp}.ics`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success("Calendario exportado correctamente");
      } catch (error) {
        console.error("Error exporting calendar:", error);
        toast.error("Error al exportar el calendario");
      }
      return;
    }

    const calendarElement = exportCalendarRef.current;
    if (!calendarElement) {
      toast.error("No se pudo generar la imagen del horario");
      return;
    }

    const exportTheme = options.theme;
    flushSync(() => setCurrentExportTheme(exportTheme));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (exportTheme) {
      calendarElement.setAttribute("data-export-theme", exportTheme);
    }
    const resetEventColors = applyExportEventColors(calendarElement, options.theme);

    try {
      const { toJpeg, toPng } = await import("html-to-image");
      const extension = options.format === "jpeg" ? "jpg" : "png";
      const dateStamp = new Date().toISOString().slice(0, 10);
      const backgroundColor = options.transparent
        ? undefined
        : options.theme === "dark"
          ? "#0b0b0b"
          : "#ffffff";

      const captureOptions = {
        quality: 0.95,
        backgroundColor,
        pixelRatio: 3,
        width: EXPORT_IMAGE_WIDTH,
        height: EXPORT_IMAGE_HEIGHT,
        style: {
          width: `${EXPORT_IMAGE_WIDTH}px`,
          height: `${EXPORT_IMAGE_HEIGHT}px`,
          overflow: "hidden" as const,
          position: "static" as const,
          zIndex: "auto" as const,
          opacity: "1" as const,
          pointerEvents: "none" as const,
        },
      };

      const dataUrl =
        options.format === "jpeg"
          ? await toJpeg(calendarElement, captureOptions)
          : await toPng(calendarElement, captureOptions);

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
      resetEventColors();
    }
  }, [calendarEvents, selectedTerm]);

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
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
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
    );
  }

  if (coursesQuery.isError) {
    return (
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
    );
  }

  return (
    <>
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
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
                  showAll={effectiveShowAllCourses}
                  onShowAllChange={handleShowAllChange}
                  showAllDisabled={!isAuthenticated}
                  showAllDisabledTooltip="Inicia sesión para habilitar este filtro"
                  showOtherCampuses={showOtherCampuses}
                  onShowOtherCampusesChange={handleOtherCampusesChange}
                />
              </div>
              {isAuthenticated && userStudyPlan && (
                <Button
                  type="button"
                  variant={isUsingProfileDefaults ? "secondary" : "outline"}
                  size="sm"
                  onClick={handleUseProfileDefaults}
                  disabled={isUsingProfileDefaults}
                  className="shrink-0 h-8 text-xs gap-1.5"
                >
                  <User className="h-3.5 w-3.5" />
                  {isUsingProfileDefaults ? 'Perfil activo' : 'Usar mi perfil'}
                </Button>
              )}
            </div>
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
                  className="border rounded-lg overflow-hidden shrink-0 h-auto lg:h-[var(--calendar-height)]"
                  style={{
                    "--calendar-height": `${calendarHeight}px`,
                  } as CSSProperties}
                >
                  {isMobile ? (
                    <div className="flex flex-col">
                      <div className="flex flex-col border-b">
                        <div className="px-4 h-[33px] bg-muted/30 shrink-0 flex items-center">
                          <div className="flex w-full items-center justify-between gap-2">
                            <h2 className="text-base font-semibold leading-none">
                              {orderedCourses.length} curso
                              {orderedCourses.length !== 1 ? "s" : ""} disponible
                              {orderedCourses.length !== 1 ? "s" : ""}
                            </h2>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={
                                isCourseListOpen
                                  ? "Contraer cursos disponibles"
                                  : "Mostrar cursos disponibles"
                              }
                              onClick={() => setIsCourseListOpen((open) => !open)}
                            >
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 transition-transform",
                                  isCourseListOpen ? "rotate-0" : "-rotate-90",
                                )}
                              />
                            </Button>
                          </div>
                        </div>
                        <div className={cn("overflow-hidden h-[50vh]", !isCourseListOpen && "hidden")}> 
                          <CourseList
                            key={isCourseListOpen ? "course-list-open" : "course-list-closed"}
                            courses={orderedCourses}
                            selectedGroups={selectedGroups}
                            onSelectionChange={updateSelectedGroups}
                            campusById={campusById}
                            showCampus={showOtherCampuses}
                          />
                        </div>
                      </div>

                      <div className="relative min-h-[65vh]">
                        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
                          <ScheduleZoomControls
                            hourHeight={hourHeight}
                            setHourHeight={setHourHeight}
                            isFloating={false}
                          />
                          <ScheduleExportDialog onExport={handleExport} />
                        </div>
                        <div
                          ref={calendarRef}
                          className="overflow-hidden p-0"
                        >
                          <Suspense fallback={<div className="h-full w-full bg-muted/20" />}>
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
                          </Suspense>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <ResizablePanelGroup
                      orientation="horizontal"
                      className="h-full"
                    >
                      <ResizablePanel
                        defaultSize="30%"
                        minSize="20%"
                        maxSize="50%"
                        className="min-w-0 overflow-hidden"
                      >
                        <div className="flex flex-col lg:h-full">
                          <div className="px-4 h-[33px] border-b bg-muted/30 shrink-0 flex items-center">
                            <div className="flex items-center gap-2">
                              <h2 className="text-base font-semibold leading-none">
                                {orderedCourses.length} curso
                                {orderedCourses.length !== 1 ? "s" : ""} disponible
                                {orderedCourses.length !== 1 ? "s" : ""}
                              </h2>
                            </div>
                          </div>
                          <div className="overflow-hidden h-[60vh] lg:flex-1 lg:h-auto">
                            <CourseList
                              courses={orderedCourses}
                              selectedGroups={selectedGroups}
                              onSelectionChange={updateSelectedGroups}
                              campusById={campusById}
                              showCampus={showOtherCampuses}
                            />
                          </div>
                        </div>
                      </ResizablePanel>

                      <ResizableHandle withHandle />

                      <ResizablePanel defaultSize="70%" className="min-w-0 overflow-hidden">
                        <div className="relative lg:h-full">
                          <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
                            <ScheduleZoomControls
                              hourHeight={hourHeight}
                              setHourHeight={setHourHeight}
                              isFloating={false}
                            />
                            <ScheduleExportDialog onExport={handleExport} />
                          </div>
                          <div
                            ref={calendarRef}
                            className="lg:h-full overflow-hidden p-0"
                          >
                            <Suspense fallback={<div className="h-full w-full bg-muted/20" />}>
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
                            </Suspense>
                          </div>
                        </div>
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  )}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>

      {/* Hidden calendar for export - behind the page, within viewport so html-to-image can capture it */}
      <div
        ref={exportCalendarRef}
        className="fixed left-0 top-0 -z-10 overflow-hidden pointer-events-none rounded-lg border bg-background opacity-0"
        style={{ width: EXPORT_IMAGE_WIDTH, height: EXPORT_IMAGE_HEIGHT }}
      >
        <Suspense fallback={null}>
          <Calendar
            events={calendarEvents}
            setEvents={() => {}}
            mode="week"
            setMode={() => {}}
            date={date}
            setDate={() => {}}
            hourHeight={EXPORT_HOUR_HEIGHT}
            dayWidth={EXPORT_DAY_WIDTH}
            exportTheme={currentExportTheme}
          />
        </Suspense>
      </div>
    </>
  );
}
