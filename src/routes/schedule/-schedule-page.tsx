import { useNavigate, useSearch } from "@tanstack/react-router";
import { startOfWeek } from "date-fns";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  Link2,
  User,
  Save,
  Bookmark,
  Trash2,
  Loader2,
  LayoutGrid,
  List,
} from "lucide-react";
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

import type { Mode, CalendarEvent } from "@/components/calendar/calendar-types";
import type { ScheduleCourse, ScheduleGroup } from "@/lib/types";

import { START_HOUR, END_HOUR } from "@/components/calendar/body/day/calendar-body-day-margin";
import { colorOptions } from "@/components/calendar/calendar-tailwind-classes";
import CourseList from "@/components/course-list";
import {
  ScheduleExportDialog,
  type ScheduleExportOptions,
  type ScheduleExportTheme,
} from "@/components/schedule/schedule-export-dialog";
import { ScheduleFilters } from "@/components/schedule/schedule-filters";
import {
  ScheduleZoomControls,
  SCHEDULE_DEFAULT_HOUR_HEIGHT,
} from "@/components/schedule/schedule-zoom-controls";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Spinner } from "@/components/ui/spinner";
import { useIsMobile } from "@/hooks/use-mobile";
import { getGroupId, sessionToEvent } from "@/lib/calendar-utils";
import { buildScheduleIcs } from "@/lib/calendar/ics";
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
import {
  useSavedSchedules,
  useSaveSchedule,
  useDeleteSchedule,
  type SavedSchedule,
} from "@/lib/hooks/use-saved-schedules";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { cn } from "@/lib/utils";

import {
  buildScheduleShortUrl,
  isMeaningfulScheduleSearch,
  normalizeScheduleUniversityId,
  SCHEDULE_DEFAULT_UNIVERSITY_ID,
} from "./-schedule-search";

const MAIN_CAMPUS_CODES = new Set(["AL", "CA", "LM", "SC", "SJ"]);
const SHOW_ALL_STORAGE_KEY = "schedule-show-all";
const SHOW_OTHER_CAMPUSES_STORAGE_KEY = "schedule-show-other-campuses";
const VIEW_MODE_STORAGE_KEY = "schedule-list-view";
const Calendar = lazy(() => import("@/components/calendar/calendar"));

function ScheduleEmptyState({
  title,
  description,
  variant = "default",
}: {
  title: string;
  description: string;
  variant?: "default" | "error";
}) {
  const Icon = variant === "error" ? AlertTriangle : CalendarDays;

  return (
    <div className="flex flex-1 px-4 lg:px-6">
      <div className="bg-card flex min-h-[45svh] w-full items-center justify-center rounded-lg border p-6 text-center md:min-h-96">
        <div className="flex max-w-sm flex-col items-center gap-3">
          <div
            className={cn(
              "flex size-12 items-center justify-center rounded-full",
              variant === "error"
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="size-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold tracking-tight md:text-xl">{title}</h2>
            <p className="text-muted-foreground text-sm md:text-base">{description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

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
    pink: ["rgb(252 231 243)", "rgb(251 207 232)", "rgb(249 168 212)", "rgb(131 24 67)"],
    olive: ["rgb(240 242 227)", "rgb(222 227 195)", "rgb(198 206 153)", "rgb(75 80 44)"],
    lime: ["rgb(236 252 203)", "rgb(217 249 157)", "rgb(190 242 100)", "rgb(63 98 18)"],
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
    pink: ["rgb(80 7 36)", "rgb(131 24 67)", "rgb(157 23 77)", "rgb(252 231 243)"],
    olive: ["rgb(34 37 20)", "rgb(54 58 31)", "rgb(94 100 50)", "rgb(240 242 227)"],
    lime: ["rgb(26 46 5)", "rgb(54 83 20)", "rgb(77 124 15)", "rgb(236 252 203)"],
  },
} as const;

function applyExportEventColors(root: HTMLElement, theme: ScheduleExportTheme) {
  const elements = root.querySelectorAll<HTMLElement>("[data-schedule-event-color]");
  elements.forEach((element) => {
    const color = element.dataset.scheduleEventColor as keyof typeof EXPORT_EVENT_COLORS.light;
    const [bg, hover, border, text] =
      EXPORT_EVENT_COLORS[theme][color] ?? EXPORT_EVENT_COLORS[theme].blue;
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

  const selectedUniversityId = search.university ?? SCHEDULE_DEFAULT_UNIVERSITY_ID;
  const selectedCampusId = search.campus ?? null;
  const selectedCareerId = search.career ?? null;
  const selectedPlanId = search.plan ?? null;
  const selectedTermId = search.term ?? null;
  const hasMeaningfulSearch = isMeaningfulScheduleSearch(search);
  const [isUsingProfileDefaults, setIsUsingProfileDefaults] = useState(() => !hasMeaningfulSearch);
  const shouldAutoSelectPlanRef = useRef(false);
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

  const [storedViewMode, setStoredViewMode] = useState<"card" | "table">(() => {
    if (typeof window === "undefined") return "card";
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored === "card" || stored === "table") return stored;
    return "card";
  });
  const viewMode = search.view ?? storedViewMode;

  const handleViewModeChange = useCallback(
    (value: string) => {
      if (value === "card" || value === "table") {
        void navigate({
          to: "/schedule",
          search: {
            ...search,
            view: value,
          },
          resetScroll: false,
        });
      }
    },
    [navigate, search],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (search.view === undefined) return;
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, search.view);
    setStoredViewMode(search.view);
  }, [search.view]);

  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const mode: Mode = "week";
  const [date] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [isCourseListOpen, setIsCourseListOpen] = useState(true);
  const [hourHeight, setHourHeight] = useState<number>(SCHEDULE_DEFAULT_HOUR_HEIGHT);
  const [currentExportTheme, setCurrentExportTheme] = useState<ScheduleExportTheme>("light");
  const [, startTransition] = useTransition();
  const totalHours = END_HOUR - START_HOUR + 1;
  const calendarHeight = totalHours * hourHeight + 33;
  const previousGroupsRef = useRef<string | undefined>(undefined);
  const calendarRef = useRef<HTMLDivElement>(null);
  const exportCalendarRef = useRef<HTMLDivElement>(null);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [scheduleName, setScheduleName] = useState("");

  const { data: savedSchedules } = useSavedSchedules();
  const saveScheduleMutation = useSaveSchedule();
  const deleteScheduleMutation = useDeleteSchedule();

  const serializedGroups = useMemo(() => {
    if (!search.groups) return [];
    return search.groups.split(",").reduce<string[]>((acc, value) => {
      const trimmed = value.trim();
      if (trimmed) acc.push(trimmed);
      return acc;
    }, []);
  }, [search.groups]);

  const { data: universities, isLoading: isLoadingUniversities } = useUniversities();
  const campusesQuery = useCampuses(selectedUniversityId);
  const careersQuery = useAcademicUnits(selectedCampusId);
  const plansQuery = useStudyPlans(selectedCareerId);
  const termsQuery = useAcademicTerms(selectedCampusId, selectedPlanId);
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
  const { data: userStudyPlan, isLoading: isUserStudyPlanLoading } = useUserStudyPlan(
    authUser?.id ?? null,
    !!authUser?.id && !isAuthLoading,
  );
  const userStudyPlanUniversityId =
    normalizeScheduleUniversityId(userStudyPlan?.universityId) ?? SCHEDULE_DEFAULT_UNIVERSITY_ID;
  const suggestedTermQuery = useSuggestedAcademicTerm(
    selectedPlanId,
    !!selectedPlanId && !selectedTermId,
  );

  const campuses = useMemo(() => campusesQuery.data ?? [], [campusesQuery.data]);
  const campusById = useMemo(
    () => new Map(campuses.map((campus) => [campus.id, campus])),
    [campuses],
  );
  const careers = careersQuery.data ?? [];
  const plans = plansQuery.data ?? [];
  const terms = useMemo(() => termsQuery.data ?? [], [termsQuery.data]);
  const isAutoSelectingLatestPlan =
    shouldAutoSelectPlanRef.current && !!selectedCareerId && !selectedPlanId && plans.length > 0;
  const isLoadingPlansForFilters =
    (plansQuery.isFetching && plansQuery.data?.length === 0) || isAutoSelectingLatestPlan;
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

  const weekStart = useMemo(() => startOfWeek(date, { weekStartsOn: 1 }), [date]);

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
        const groupId = getGroupId(course.course_code, group.group_code);
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
    if (!isAuthenticated) return;
    if (!userStudyPlan || !isUsingProfileDefaults) return;
    if (
      selectedUniversityId === userStudyPlanUniversityId &&
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
      const profileSearch: Record<string, unknown> = {
        ...search,
        u: normalizeScheduleUniversityId(userStudyPlan.universityId),
        university: normalizeScheduleUniversityId(userStudyPlan.universityId),
        c: userStudyPlan.campusId ?? undefined,
        campus: userStudyPlan.campusId ?? undefined,
        r: userStudyPlan.academicUnitId ?? undefined,
        career: userStudyPlan.academicUnitId ?? undefined,
        p: userStudyPlan.studyPlanId ?? undefined,
        plan: userStudyPlan.studyPlanId ?? undefined,
      };
      void navigate({
        to: "/schedule",
        search: profileSearch as never,
      });
    }
  }, [
    isAuthenticated,
    isUsingProfileDefaults,
    navigate,
    selectedUniversityId,
    search,
    userStudyPlan,
    userStudyPlanUniversityId,
  ]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!userStudyPlan) return;
    const hasSearch = hasMeaningfulSearch;
    if (!hasSearch) {
      setIsUsingProfileDefaults(true);
      return;
    }
    const matchesProfile =
      selectedUniversityId === userStudyPlanUniversityId &&
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
    if (!shouldAutoSelectPlanRef.current) return;
    if (!selectedCareerId) return;
    if (selectedPlanId) {
      shouldAutoSelectPlanRef.current = false;
      return;
    }
    if (plansQuery.isFetching) return;
    if (!plans.length) {
      shouldAutoSelectPlanRef.current = false;
      return;
    }

    shouldAutoSelectPlanRef.current = false;
    const autoPlanSearch: Record<string, unknown> = {
      ...search,
      p: plans[0].id,
      plan: plans[0].id,
      t: undefined,
      term: undefined,
    };
    void navigate({
      to: "/schedule",
      search: autoPlanSearch as never,
    });
  }, [navigate, plans, plansQuery.isFetching, search, selectedCareerId, selectedPlanId]);

  useEffect(() => {
    if (
      selectedPlanId &&
      terms.length > 0 &&
      !selectedTermId &&
      !termsQuery.isFetching &&
      suggestedTermQuery.isSuccess &&
      suggestedTermQuery.data
    ) {
      const autoTerm1: Record<string, unknown> = {
        ...search,
        t: suggestedTermQuery.data,
        term: suggestedTermQuery.data,
      };
      void navigate({
        to: "/schedule",
        search: autoTerm1 as never,
      });
    } else if (
      selectedPlanId &&
      terms.length > 0 &&
      !selectedTermId &&
      !termsQuery.isFetching &&
      suggestedTermQuery.isSuccess &&
      !suggestedTermQuery.data
    ) {
      const autoTerm2: Record<string, unknown> = {
        ...search,
        t: terms[0].id,
        term: terms[0].id,
      };
      void navigate({
        to: "/schedule",
        search: autoTerm2 as never,
      });
    }
  }, [
    selectedPlanId,
    terms,
    termsQuery.isFetching,
    selectedTermId,
    search,
    navigate,
    suggestedTermQuery.data,
    suggestedTermQuery.isSuccess,
  ]);

  useEffect(() => {
    if (!selectedCampusId) return;
    if (campusesQuery.isFetching) return;
    if (campuses.some((c) => c.id === selectedCampusId)) return;

    shouldAutoSelectPlanRef.current = false;
    const validateCampusSearch: Record<string, unknown> = {
      ...search,
      c: undefined,
      campus: undefined,
      r: undefined,
      career: undefined,
      p: undefined,
      plan: undefined,
      t: undefined,
      term: undefined,
    };
    void navigate({
      to: "/schedule",
      search: validateCampusSearch as never,
    });
  }, [selectedCampusId, campuses, campusesQuery.isFetching, navigate, search]);

  useEffect(() => {
    if (!selectedCareerId) return;
    if (careersQuery.isFetching) return;
    if (careers.some((c) => c.id === selectedCareerId)) return;

    shouldAutoSelectPlanRef.current = false;
    const validateCareerSearch: Record<string, unknown> = {
      ...search,
      r: undefined,
      career: undefined,
      p: undefined,
      plan: undefined,
      t: undefined,
      term: undefined,
    };
    void navigate({
      to: "/schedule",
      search: validateCareerSearch as never,
    });
  }, [selectedCareerId, careers, careersQuery.isFetching, navigate, search]);

  useEffect(() => {
    if (!selectedPlanId) return;
    if (plansQuery.isFetching) return;
    if (plans.some((p) => p.id === selectedPlanId)) return;

    shouldAutoSelectPlanRef.current = true;
    const validatePlanSearch: Record<string, unknown> = {
      ...search,
      p: undefined,
      plan: undefined,
      t: undefined,
      term: undefined,
    };
    void navigate({
      to: "/schedule",
      search: validatePlanSearch as never,
    });
  }, [selectedPlanId, plans, plansQuery.isFetching, navigate, search]);

  useEffect(() => {
    if (!selectedTermId) return;
    if (termsQuery.isFetching) return;
    if (terms.some((t) => t.id === selectedTermId)) return;

    const validateTermSearch: Record<string, unknown> = {
      ...search,
      t: undefined,
      term: undefined,
    };
    void navigate({
      to: "/schedule",
      search: validateTermSearch as never,
    });
  }, [selectedTermId, terms, termsQuery.isFetching, navigate, search]);

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
    localStorage.setItem(SHOW_OTHER_CAMPUSES_STORAGE_KEY, String(search.otherCampuses));
    setStoredShowOtherCampuses(search.otherCampuses);
  }, [search.otherCampuses]);

  useEffect(() => {
    if (!search.loadSchedule || !orderedCourses.length) return;

    let cancelled = false;

    void (async () => {
      try {
        const sb = getSupabaseBrowserClient();
        const { data: items, error } = await sb.rpc("get_user_saved_schedule_group_lookups", {
          p_saved_schedule_id: search.loadSchedule,
        });

        if (error) throw error;
        if (cancelled) return;

        const savedGroupLookups = (items ?? []) as Array<{
          course_code: string;
          campus_id: number | null;
          group_code: string;
        }>;
        const lookupSet = new Set(
          savedGroupLookups.map((i) => `${i.course_code}-${i.campus_id ?? ""}-${i.group_code}`),
        );
        const matchingGroups: string[] = [];

        groupById.forEach((value, key) => {
          if (
            lookupSet.has(
              `${value.course.course_code}-${value.campusId ?? ""}-${value.group.group_code}`,
            )
          ) {
            matchingGroups.push(key);
          }
        });

        if (cancelled) return;

        void navigate({
          to: "/schedule",
          search: {
            ...search,
            loadSchedule: undefined,
            groups: matchingGroups.length ? matchingGroups.join(",") : undefined,
          },
          resetScroll: false,
        });
      } catch {
        toast.error("Error al cargar el horario");
        if (!cancelled) {
          void navigate({
            to: "/schedule",
            search: {
              ...search,
              loadSchedule: undefined,
            },
            resetScroll: false,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- search is intentionally excluded to avoid infinite loops; only search.loadSchedule should trigger this effect
  }, [search.loadSchedule, orderedCourses.length, navigate, groupById]);

  const updateSelectedGroups = useCallback(
    (nextGroups: Set<string>) => {
      setSelectedGroups(nextGroups);
      const nextGroupsValue = nextGroups.size ? Array.from(nextGroups).join(",") : undefined;
      if (nextGroupsValue === search.groups) return;
      startTransition(() => {
        void navigate({
          to: "/schedule",
          search: {
            ...search,
            groups: nextGroupsValue,
            g: nextGroupsValue,
          } as never,
          resetScroll: false,
        });
      });
    },
    [navigate, search, startTransition],
  );

  const handleUniversityChange = useCallback(
    (id: number | null) => {
      shouldAutoSelectPlanRef.current = false;
      setIsUsingProfileDefaults(false);
      void navigate({
        to: "/schedule",
        search: {
          ...search,
          university: normalizeScheduleUniversityId(id),
          u: normalizeScheduleUniversityId(id),
        } as never,
      });
    },
    [navigate, search],
  );

  const handleCampusChange = useCallback(
    (id: number | null) => {
      shouldAutoSelectPlanRef.current = false;
      setIsUsingProfileDefaults(false);
      const newSearch: Record<string, unknown> = {
        ...search,
        c: id ?? undefined,
        campus: id ?? undefined,
      };
      void navigate({
        to: "/schedule",
        search: newSearch as never,
      });
    },
    [navigate, search],
  );

  const handleCareerChange = useCallback(
    (id: number | null) => {
      shouldAutoSelectPlanRef.current = id !== null;
      setIsUsingProfileDefaults(false);
      const newSearch: Record<string, unknown> = {
        ...search,
        r: id ?? undefined,
        career: id ?? undefined,
        p: undefined,
        plan: undefined,
        t: undefined,
        term: undefined,
      };
      void navigate({
        to: "/schedule",
        search: newSearch as never,
      });
    },
    [navigate, search],
  );

  const handlePlanChange = useCallback(
    (id: number | null) => {
      shouldAutoSelectPlanRef.current = false;
      setIsUsingProfileDefaults(false);
      const newSearch: Record<string, unknown> = {
        ...search,
        p: id ?? undefined,
        plan: id ?? undefined,
      };
      void navigate({
        to: "/schedule",
        search: newSearch as never,
      });
    },
    [navigate, search],
  );

  const handleTermChange = useCallback(
    (id: number | null) => {
      setIsUsingProfileDefaults(false);
      const newSearch: Record<string, unknown> = {
        ...search,
        t: id ?? undefined,
        term: id ?? undefined,
      };
      void navigate({
        to: "/schedule",
        search: newSearch as never,
      });
    },
    [navigate, search],
  );

  const handleOtherCampusesChange = useCallback(
    (checked: boolean) => {
      void navigate({
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
      void navigate({
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

    const newSearch: Record<string, unknown> = {
      ...search,
      university: normalizeScheduleUniversityId(userStudyPlan.universityId),
      u: normalizeScheduleUniversityId(userStudyPlan.universityId),
      campus: userStudyPlan.campusId ?? undefined,
      c: userStudyPlan.campusId ?? undefined,
      career: userStudyPlan.academicUnitId ?? undefined,
      r: userStudyPlan.academicUnitId ?? undefined,
      plan: userStudyPlan.studyPlanId ?? undefined,
      p: userStudyPlan.studyPlanId ?? undefined,
      term: search.term ?? undefined,
      t: search.term ?? undefined,
    };

    void navigate({
      to: "/schedule",
      search: newSearch as never,
    });
  }, [navigate, search, userStudyPlan]);

  const handleCopyShortLink = useCallback(async () => {
    try {
      const shortUrl = buildScheduleShortUrl(
        {
          ...search,
          university: selectedUniversityId,
        },
        window.location.origin,
      );
      await navigator.clipboard.writeText(shortUrl);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  }, [search, selectedUniversityId]);

  const assignedColorsRef = useRef<Map<string, string>>(new Map());

  const courseColors = useMemo(() => {
    const activeCourseCodes = new Set<string>();
    selectedGroups.forEach((groupId) => {
      const groupData = groupById.get(groupId);
      if (groupData) {
        activeCourseCodes.add(groupData.course.course_code);
      }
    });

    const currentMap = assignedColorsRef.current;

    for (const [courseCode] of currentMap.entries()) {
      if (!activeCourseCodes.has(courseCode)) {
        currentMap.delete(courseCode);
      }
    }

    const usedColors = new Set(currentMap.values());

    activeCourseCodes.forEach((courseCode) => {
      if (!currentMap.has(courseCode)) {
        const availableColor = colorOptions.find((c) => !usedColors.has(c.value));

        if (availableColor) {
          currentMap.set(courseCode, availableColor.value);
          usedColors.add(availableColor.value);
        } else {
          const fallbackColor = colorOptions[currentMap.size % colorOptions.length].value;
          currentMap.set(courseCode, fallbackColor);
        }
      }
    });

    return new Map(currentMap);
  }, [selectedGroups, groupById]);

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
        ? (campusById.get(groupData.campusId)?.name ?? null)
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
        } catch {
          // ignore
        }
      });
    });

    return events;
  }, [selectedGroups, courseColors, weekStart, campusById, groupById, orderedCourses]);

  const handleExport = useCallback(
    async (options: ScheduleExportOptions) => {
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
        } catch {
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
      } catch {
        toast.error("Error al exportar el horario");
      } finally {
        if (exportTheme) {
          calendarElement.removeAttribute("data-export-theme");
        }
        resetEventColors();
      }
    },
    [calendarEvents, selectedTerm],
  );

  const handleRemoveEvent = useCallback(
    (event: CalendarEvent) => {
      const next = new Set(selectedGroups);
      next.delete(event.groupId);
      updateSelectedGroups(next);
    },
    [selectedGroups, updateSelectedGroups],
  );

  const handleSaveSchedule = useCallback(() => {
    if (!selectedTermId) return;

    const groupLookups: Array<{
      courseCode: string;
      campusId: number | null;
      groupCode: string;
    }> = [];
    selectedGroups.forEach((groupId) => {
      const data = groupById.get(groupId);
      if (data) {
        groupLookups.push({
          courseCode: data.course.course_code,
          campusId: data.campusId,
          groupCode: data.group.group_code,
        });
      }
    });

    saveScheduleMutation.mutate(
      {
        name: scheduleName.trim(),
        academicTermId: selectedTermId,
        groupLookups,
      },
      {
        onSuccess: () => {
          toast.success("Horario guardado correctamente");
          setSaveDialogOpen(false);
          setScheduleName("");
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Error al guardar el horario");
        },
      },
    );
  }, [selectedGroups, groupById, selectedTermId, scheduleName, saveScheduleMutation]);

  const handleLoadSchedule = useCallback(
    (schedule: SavedSchedule) => {
      if (schedule.academic_term_id === selectedTermId) {
        void navigate({
          to: "/schedule",
          search: {
            ...search,
            loadSchedule: schedule.id,
          },
          resetScroll: false,
        });
      } else {
        void navigate({
          to: "/schedule",
          search: {
            ...search,
            term: schedule.academic_term_id,
            loadSchedule: schedule.id,
            groups: undefined,
          },
          resetScroll: false,
        });
      }
    },
    [selectedTermId, navigate, search],
  );

  const handleDeleteSchedule = useCallback(
    (scheduleId: number) => {
      deleteScheduleMutation.mutate(scheduleId, {
        onSuccess: () => toast.success("Horario eliminado"),
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Error al eliminar"),
      });
    },
    [deleteScheduleMutation],
  );

  const isLoadingFilters =
    isLoadingUniversities ||
    campusesQuery.isLoading ||
    careersQuery.isLoading ||
    plansQuery.isLoading ||
    termsQuery.isLoading;
  const isInitialLoading = isLoadingFilters && !universities?.length;
  const hasRequiredScheduleFilters = !!selectedCampusId && !!selectedTermId;
  const isProfileLoading = isUsingProfileDefaults && (isAuthLoading || isUserStudyPlanLoading);
  const isAutoSelectingPlan =
    shouldAutoSelectPlanRef.current &&
    !!selectedCareerId &&
    !selectedPlanId &&
    (plansQuery.isFetching || plans.length > 0);
  const isAutoSelectingTerm =
    !!selectedPlanId &&
    !selectedTermId &&
    (termsQuery.isFetching || suggestedTermQuery.isPending || terms.length > 0);
  const isPendingFilters = isProfileLoading || isAutoSelectingPlan || isAutoSelectingTerm;

  if (isInitialLoading) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
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
                    isLoadingPlans={isLoadingPlansForFilters}
                    isLoadingTerms={termsQuery.isFetching && termsQuery.data?.length === 0}
                    showAll={effectiveShowAllCourses}
                    onShowAllChange={handleShowAllChange}
                    showAllDisabled={!isAuthenticated}
                    showAllDisabledTooltip="Inicia sesión para habilitar este filtro"
                    showOtherCampuses={showOtherCampuses}
                    onShowOtherCampusesChange={handleOtherCampusesChange}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-1 px-4 lg:px-6">
              <div className="bg-card flex min-h-[45svh] w-full items-center justify-center rounded-lg border p-6 md:min-h-96">
                <Spinner className="text-muted-foreground size-6" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (coursesQuery.isError) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
            <ScheduleEmptyState
              title="Error al cargar el horario"
              description={
                coursesQuery.error instanceof Error
                  ? coursesQuery.error.message
                  : "Error desconocido"
              }
              variant="error"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-1 flex-col gap-4 py-4 md:gap-6 md:py-6">
            <header className="sr-only">
              <h1>Creador de horarios TEC</h1>
              <p>
                Crea horarios del TEC, explora cursos por sede y periodo, compara grupos y arma una
                combinacion clara para organizar tu semestre. Tambien puedes usarlo para buscar
                variantes como crear horarios TEC o planificar horarios academicos por carrera.
              </p>
            </header>

            <div className="px-4 lg:px-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
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
                    isLoadingPlans={isLoadingPlansForFilters}
                    isLoadingTerms={termsQuery.isFetching && termsQuery.data?.length === 0}
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
                    className="h-8 shrink-0 gap-1.5 text-xs"
                  >
                    <User className="size-3.5" />
                    {isUsingProfileDefaults ? "Perfil activo" : "Usar mi perfil"}
                  </Button>
                )}
              </div>
            </div>

            {isPendingFilters && (
              <div className="flex flex-1 px-4 lg:px-6">
                <div className="bg-card flex min-h-[45svh] w-full items-center justify-center rounded-lg border p-6 md:min-h-96">
                  <Spinner className="text-muted-foreground size-6" />
                </div>
              </div>
            )}

            {!hasRequiredScheduleFilters && !coursesQuery.isLoading && !isPendingFilters && (
              <ScheduleEmptyState
                title="Selecciona los filtros del horario"
                description="Selecciona una sede y un periodo para visualizar los cursos disponibles."
              />
            )}

            {hasRequiredScheduleFilters && coursesQuery.isLoading && !isPendingFilters && (
              <div className="flex flex-1 px-4 lg:px-6">
                <div className="bg-card flex min-h-[45svh] w-full items-center justify-center rounded-lg border p-6 md:min-h-96">
                  <Spinner className="text-muted-foreground size-6" />
                </div>
              </div>
            )}

            {hasRequiredScheduleFilters && !orderedCourses.length && !coursesQuery.isLoading && (
              <ScheduleEmptyState
                title="No hay cursos disponibles"
                description="No se encontraron cursos con los filtros actuales. Prueba cambiando el periodo, carrera o sede."
              />
            )}

            {hasRequiredScheduleFilters && orderedCourses.length > 0 && (
              <div className="px-4 lg:px-6">
                <div
                  className="h-auto shrink-0 overflow-hidden rounded-lg border lg:h-[var(--calendar-height)]"
                  style={
                    {
                      "--calendar-height": `${calendarHeight}px`,
                    } as CSSProperties
                  }
                >
                  {isMobile ? (
                    <div className="flex flex-col">
                      <div className="flex flex-col border-b">
                        <div className="bg-muted/30 border-border flex h-10 shrink-0 items-center border-b px-3">
                          <div className="flex w-full items-center justify-between gap-2">
                            <h2 className="text-base leading-none font-semibold">
                              {orderedCourses.length} curso
                              {orderedCourses.length !== 1 ? "s" : ""} disponible
                              {orderedCourses.length !== 1 ? "s" : ""}
                            </h2>
                            <div className="flex items-center">
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-10 w-10 rounded-none"
                                onClick={() =>
                                  handleViewModeChange(viewMode === "card" ? "table" : "card")
                                }
                                aria-label="Cambiar vista"
                              >
                                {viewMode === "card" ? (
                                  <List className="size-4" />
                                ) : (
                                  <LayoutGrid className="size-4" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="-mr-3 h-10 w-10 rounded-none"
                                aria-label={
                                  isCourseListOpen
                                    ? "Contraer cursos disponibles"
                                    : "Mostrar cursos disponibles"
                                }
                                onClick={() => setIsCourseListOpen((open) => !open)}
                              >
                                <ChevronDown
                                  className={cn(
                                    "size-4 transition-transform",
                                    isCourseListOpen ? "rotate-0" : "-rotate-90",
                                  )}
                                />
                              </Button>
                            </div>
                          </div>
                        </div>
                        <div
                          className={cn("h-[50vh] overflow-hidden", !isCourseListOpen && "hidden")}
                        >
                          <CourseList
                            key={isCourseListOpen ? "course-list-open" : "course-list-closed"}
                            courses={orderedCourses}
                            selectedGroups={selectedGroups}
                            onSelectionChange={updateSelectedGroups}
                            campusById={campusById}
                            showCampus={showOtherCampuses}
                            viewMode={viewMode}
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
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            title="Copiar enlace corto"
                            onClick={handleCopyShortLink}
                          >
                            <Link2 className="size-4" />
                          </Button>
                          {isAuthenticated && (
                            <>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    title="Mis horarios guardados"
                                  >
                                    <Bookmark className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  {!savedSchedules?.length ? (
                                    <DropdownMenuItem disabled>
                                      Sin horarios guardados
                                    </DropdownMenuItem>
                                  ) : (
                                    savedSchedules.map((s) => (
                                      <DropdownMenuItem
                                        key={s.id}
                                        onClick={() => handleLoadSchedule(s)}
                                      >
                                        <div className="flex w-full items-center justify-between">
                                          <span>{s.name}</span>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteSchedule(s.id);
                                            }}
                                            className="text-muted-foreground hover:text-destructive ml-2 inline-flex cursor-pointer items-center"
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") {
                                                e.stopPropagation();
                                                handleDeleteSchedule(s.id);
                                              }
                                            }}
                                          >
                                            <Trash2 className="size-3.5" />
                                          </button>
                                        </div>
                                      </DropdownMenuItem>
                                    ))
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    disabled={!selectedGroups.size}
                                    title="Guardar horario actual"
                                  >
                                    <Save className="size-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Guardar horario</DialogTitle>
                                    <DialogDescription className="sr-only">
                                      Guarda los grupos seleccionados como un horario con nombre
                                      personalizado.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 pt-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="schedule-name-mobile">
                                        Nombre del horario
                                      </Label>
                                      <Input
                                        id="schedule-name-mobile"
                                        value={scheduleName}
                                        onChange={(e) => setScheduleName(e.target.value)}
                                        placeholder="Ej: IS-2026-1"
                                      />
                                    </div>
                                    <Button
                                      onClick={handleSaveSchedule}
                                      disabled={
                                        !scheduleName.trim() || saveScheduleMutation.isPending
                                      }
                                      className="w-full"
                                    >
                                      {saveScheduleMutation.isPending && (
                                        <Loader2 className="mr-2 size-4 animate-spin" />
                                      )}
                                      Guardar
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </>
                          )}
                          <ScheduleExportDialog onExport={handleExport} />
                        </div>
                        <div ref={calendarRef} className="overflow-hidden p-0">
                          <Suspense fallback={<div className="bg-muted/20 h-full w-full" />}>
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
                    <ResizablePanelGroup orientation="horizontal" className="h-full">
                      <ResizablePanel
                        defaultSize="30%"
                        minSize="20%"
                        maxSize="50%"
                        className="min-w-0 overflow-hidden"
                      >
                        <div className="flex flex-col lg:h-full">
                          <div className="bg-muted/30 border-border flex h-[33px] shrink-0 items-center border-b px-4">
                            <div className="flex w-full items-center justify-between gap-2">
                              <h2 className="text-base leading-none font-semibold">
                                {orderedCourses.length} curso
                                {orderedCourses.length !== 1 ? "s" : ""} disponible
                                {orderedCourses.length !== 1 ? "s" : ""}
                              </h2>
                              <Button
                                type="button"
                                variant="ghost"
                                className="-mr-4 h-[33px] w-[33px] rounded-none"
                                onClick={() =>
                                  handleViewModeChange(viewMode === "card" ? "table" : "card")
                                }
                                aria-label="Cambiar vista"
                              >
                                {viewMode === "card" ? (
                                  <List className="size-4" />
                                ) : (
                                  <LayoutGrid className="size-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                          <div className="h-[60vh] overflow-hidden lg:h-auto lg:flex-1">
                            <CourseList
                              courses={orderedCourses}
                              selectedGroups={selectedGroups}
                              onSelectionChange={updateSelectedGroups}
                              campusById={campusById}
                              showCampus={showOtherCampuses}
                              viewMode={viewMode}
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
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              title="Copiar enlace corto"
                              onClick={handleCopyShortLink}
                            >
                              <Link2 className="size-4" />
                            </Button>
                            {isAuthenticated && (
                              <>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      title="Mis horarios guardados"
                                    >
                                      <Bookmark className="size-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-56">
                                    {!savedSchedules?.length ? (
                                      <DropdownMenuItem disabled>
                                        Sin horarios guardados
                                      </DropdownMenuItem>
                                    ) : (
                                      savedSchedules.map((s) => (
                                        <DropdownMenuItem
                                          key={s.id}
                                          onClick={() => handleLoadSchedule(s)}
                                        >
                                          <div className="flex w-full items-center justify-between">
                                            <span>{s.name}</span>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteSchedule(s.id);
                                              }}
                                              className="text-muted-foreground hover:text-destructive ml-2 inline-flex cursor-pointer items-center"
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                  e.stopPropagation();
                                                  handleDeleteSchedule(s.id);
                                                }
                                              }}
                                            >
                                              <Trash2 className="size-3.5" />
                                            </button>
                                          </div>
                                        </DropdownMenuItem>
                                      ))
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      disabled={!selectedGroups.size}
                                      title="Guardar horario actual"
                                    >
                                      <Save className="size-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Guardar horario</DialogTitle>
                                      <DialogDescription className="sr-only">
                                        Guarda los grupos seleccionados como un horario con nombre
                                        personalizado.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 pt-4">
                                      <div className="space-y-2">
                                        <Label htmlFor="schedule-name-desktop">
                                          Nombre del horario
                                        </Label>
                                        <Input
                                          id="schedule-name-desktop"
                                          value={scheduleName}
                                          onChange={(e) => setScheduleName(e.target.value)}
                                          placeholder="Ej: IS-2026-1"
                                        />
                                      </div>
                                      <Button
                                        onClick={handleSaveSchedule}
                                        disabled={
                                          !scheduleName.trim() || saveScheduleMutation.isPending
                                        }
                                        className="w-full"
                                      >
                                        {saveScheduleMutation.isPending && (
                                          <Loader2 className="mr-2 size-4 animate-spin" />
                                        )}
                                        Guardar
                                      </Button>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </>
                            )}
                            <ScheduleExportDialog onExport={handleExport} />
                          </div>
                          <div ref={calendarRef} className="overflow-hidden p-0 lg:h-full">
                            <Suspense fallback={<div className="bg-muted/20 h-full w-full" />}>
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
        className="bg-background pointer-events-none fixed top-0 left-0 -z-10 overflow-hidden rounded-lg border opacity-0"
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
