import { useQuery, useMutation, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import type {
  AcademicTerm,
  StudyPeriod,
  CatalogStudyPlan,
  StudyPlanCourse,
  StudyPlanDetail,
  UserProfileContextRow,
  DashboardStats,
  SemesterProgress,
  NextCourse,
  CourseAttempt,
  CourseLatestTermGroup,
  CourseRecentProfessor,
} from "@/lib/types";
import { getLocalCourseStatusChanges } from "@/lib/utils/local-storage-utils";

export function useUniversities() {
  return useQuery({
    queryKey: ["universities"],
    queryFn: async () => {
      const sb = getSupabaseBrowserClient();
      const { data, error } = await sb
        .from("v_universities")
        .select("id,name,short_name")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useCampuses(universityId: number | null) {
  return useQuery({
    queryKey: ["campuses", universityId],
    queryFn: async () => {
      if (!universityId) return [];
      const sb = getSupabaseBrowserClient();
      const { data, error } = await sb
        .rpc("get_campuses_for_university", { p_university_id: universityId })
        .select("id,university_id,code,name")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CampusRow[];
    },
    enabled: !!universityId,
    placeholderData: keepPreviousData,
  });
}

export function useAcademicUnits(campusId: number | null) {
  return useQuery({
    queryKey: ["academicUnits", campusId],
    queryFn: async () => {
      if (!campusId) return [];
      const sb = getSupabaseBrowserClient();
      const { data, error } = await sb
        .rpc("get_academic_units_for_campus", { p_campus_id: campusId })
        .select("id,code,name")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AcademicUnitRow[];
    },
    enabled: !!campusId,
    placeholderData: keepPreviousData,
  });
}

export function useStudyPlans(academicUnitId: number | null) {
  return useQuery({
    queryKey: ["studyPlansV2", academicUnitId],
    queryFn: async () => {
      if (!academicUnitId) return [];

      const sb = getSupabaseBrowserClient();

      const { data, error } = await sb
        .rpc("get_study_plans_for_academic_unit", { p_academic_unit_id: academicUnitId })
        .select("id,academic_unit_id,external_plan_id,name,academic_degree,modality_name");

      if (error) throw error;
      return (data ?? []) as CatalogStudyPlan[];
    },
    enabled: !!academicUnitId,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useProfileContext(userId: string | null) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const sb = getSupabaseBrowserClient();
      const { data, error } = await sb
        .rpc("get_user_profile_with_context", { p_user_id: userId })
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as UserProfileContextRow | null;
    },
    enabled: !!userId,
  });
}

export function useAuthUser() {
  return useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      const sb = getSupabaseBrowserClient();
      const { data, error } = await sb.auth.getUser();
      if (error) return null;
      return data.user;
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useOnboardingStatus(userId: string | null) {
  return useQuery({
    queryKey: ["onboardingStatus", userId],
    queryFn: async () => {
      if (!userId) return null;
      const sb = getSupabaseBrowserClient();
      const { data, error } = await sb
        .from("user")
        .select("onboarding_dismissed_at,onboarding_completed_at")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}

export type UniversityRow = {
  id: number;
  name: string;
  short_name: string;
};

export type CampusRow = {
  id: number;
  university_id: number;
  code: string;
  name: string;
};

export type AcademicUnitRow = {
  id: number;
  code: string;
  name: string;
};

export type CourseEquivalentsResult = {
  data: Array<{ id: number; code: string | null; name: string | null; totalCount: number }>;
  totalCount: number;
};

export type CourseRelation = {
  fromCourseId: number;
  toCourseId: number;
  relationType: 'PREREQUISITE' | 'COREQUISITE' | 'EQUIVALENT';
};

function buildStudyPlanPeriods(items: Array<Record<string, unknown>>): StudyPeriod[] {
  const periods = new Map<number | null, { levelLabel?: string; courses: StudyPlanCourse[] }>();
  for (const item of items ?? []) {
    const course: StudyPlanCourse = {
      courseId: item.course_id as number,
      levelNumber: item.level_number as number | null,
      credits: item.credits as number,
      weeklyHours: item.weekly_hours as number,
      sortOrder: item.sort_order as number,
      courseCode: item.course_code as string,
      courseName: item.course_name as string,
      courseDefaultCredits: item.default_credits as number,
      courseDefaultWeeklyHours: item.default_weekly_hours as number,
    };
    const level = (item.level_number as number | null) ?? 0;
    if (!periods.has(level)) {
      periods.set(level, { levelLabel: item.level_label as string | undefined, courses: [] });
    }
    periods.get(level)!.courses.push(course);
  }

  return Array.from(periods.entries())
    .sort(([a], [b]) => (a ?? 0) - (b ?? 0))
    .map(([levelNumber, { levelLabel, courses }]): StudyPeriod => ({
      levelNumber: levelNumber ?? 0,
      levelLabel,
      courses,
    }));
}

export function useStudyPlanCoursesDetails(planId: number | null) {
  return useQuery({
    queryKey: ["studyPlanCourses", planId],
    queryFn: async () => {
      if (!planId) return null;
      const sb = getSupabaseBrowserClient();
      const coursesResult = await sb.rpc("get_study_plan_courses_details", { p_study_plan_id: planId });
      if (coursesResult.error) throw coursesResult.error;
      return buildStudyPlanPeriods(coursesResult.data ?? []);
    },
    enabled: !!planId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStudyPlanDetail(planId: number | null, selectedPlanData: CatalogStudyPlan | undefined) {
  return useQuery({
    queryKey: ["studyPlanDetail", planId],
    queryFn: async () => {
      if (!planId) return null;
      const sb = getSupabaseBrowserClient();

      const [coursesResult, relationsResult] = await Promise.all([
        sb.rpc("get_study_plan_courses_details", { p_study_plan_id: planId }),
        sb.from("course_relation")
          .select("from_course_id, to_course_id, relation_type")
          .eq("study_plan_id", planId),
      ]);

      if (coursesResult.error) throw coursesResult.error;
      if (relationsResult.error) throw relationsResult.error;

      const courseRelations = new Map<number, { prerequisites: number[]; corequisites: number[]; equivalents: number[] }>();
      for (const r of relationsResult.data ?? []) {
        const existing = courseRelations.get(r.from_course_id) ?? { prerequisites: [], corequisites: [], equivalents: [] };
        if (r.relation_type === 'PREREQUISITE') {
          existing.prerequisites.push(r.to_course_id);
        } else if (r.relation_type === 'COREQUISITE') {
          existing.corequisites.push(r.to_course_id);
        } else if (r.relation_type === 'EQUIVALENT') {
          existing.equivalents.push(r.to_course_id);
        }
        courseRelations.set(r.from_course_id, existing);
      }

      const periodArray = buildStudyPlanPeriods(coursesResult.data ?? []);

      return {
        plan: { id: planId, academic_unit_id: 0, external_plan_id: 0, name: "", academic_degree: null, modality_name: undefined } as CatalogStudyPlan,
        periods: periodArray,
        courseRelations,
      } as StudyPlanDetail;
    },
    select: (data) => {
      if (!data) return data;
      return {
        ...data,
        plan: selectedPlanData ? { ...selectedPlanData } as CatalogStudyPlan : data.plan,
      };
    },
    enabled: !!planId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserStudyPlan(userId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["userStudyPlan", userId],
    queryFn: async () => {
      if (!userId) return null;
      const sb = getSupabaseBrowserClient();

      const { data, error } = await sb
        .rpc("get_user_profile_with_context", { p_user_id: userId })
        .select("*")
        .maybeSingle();

      if (error) throw error;
      const profile = data as UserProfileContextRow | null;
      if (!profile || !profile.study_plan_id) return null;

      return {
        userId,
        universityId: profile.university_id,
        campusId: profile.campus_id,
        academicUnitId: profile.academic_unit_id,
        studyPlanId: profile.study_plan_id,
        studyPlanName: profile.study_plan_name,
      };
    },
    enabled: enabled && !!userId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useAcademicTerms(campusId: number | null) {
  return useQuery({
    queryKey: ["academicTerms", campusId],
    queryFn: async () => {
      if (!campusId) return [];
      const sb = getSupabaseBrowserClient();
      const { data, error } = await sb
        .rpc("get_active_academic_terms")
        .select("*")
        .order("year", { ascending: false })
        .order("period_number", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AcademicTerm[];
    },
    enabled: !!campusId,
    placeholderData: keepPreviousData,
  });
}

export function useCourseInferredAcademicTerms(
  courseId: number | null,
  campusId: number | null,
  academicUnitId: number | null,
) {
  return useQuery({
    queryKey: ["courseInferredAcademicTerms", courseId, campusId, academicUnitId],
    queryFn: async () => {
      if (!courseId) return [];

      const sb = getSupabaseBrowserClient();
      const { data, error } = await sb
        .rpc("get_course_active_academic_terms", {
          p_course_id: courseId,
          p_campus_id: campusId,
          p_academic_unit_id: academicUnitId,
        })
        .select("*")
        .order("year", { ascending: false })
        .order("period_number", { ascending: false });

      if (error) throw error;
      return (data ?? []) as AcademicTerm[];
    },
    enabled: !!courseId,
    placeholderData: keepPreviousData,
  });
}

export function useScheduleCourses(params: {
  termId: number | null;
  campusId: number | null;
  careerId: number | null;
  planId: number | null;
  includeOtherCampuses: boolean;
  showAllCourses: boolean;
  userId: string | null;
  isAuthReady: boolean;
}) {
  const {
    termId,
    campusId,
    careerId,
    planId,
    includeOtherCampuses,
    showAllCourses,
    userId,
    isAuthReady,
  } = params;

  return useQuery({
    queryKey: [
      "scheduleCourses",
      termId,
      campusId,
      careerId,
      planId,
      includeOtherCampuses,
      userId ? showAllCourses : true,
      userId,
    ],
    queryFn: async () => {
      if (!termId || !campusId) return null;
      const sb = getSupabaseBrowserClient();

      const { data, error } = await sb
        .rpc("get_schedule_courses", {
          p_user_id: userId,
          p_academic_term_id: termId,
          p_campus_id: campusId,
          p_study_plan_id: planId,
          p_academic_unit_id: careerId,
          p_include_other_campuses: includeOtherCampuses,
          p_show_all_courses: userId ? showAllCourses : true,
        })
        .select("*");

      if (error) throw error;
      return (data ?? []) as import('@/lib/types').ScheduleCourse[];
    },
    enabled: isAuthReady && !!termId && !!campusId,
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useSuggestedAcademicTerm(studyPlanId: number | null, enabled = true) {
  return useQuery({
    queryKey: ["suggestedAcademicTerm", studyPlanId],
    queryFn: async () => {
      if (!studyPlanId) return null;
      const sb = getSupabaseBrowserClient();
      const { data, error } = await sb
        .rpc("get_suggested_academic_term", { p_study_plan_id: studyPlanId });
      if (error) throw error;
      return data as number | null;
    },
    enabled: enabled && !!studyPlanId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStudentCourseStatuses(userId: string | null, studyPlanId: number | null) {
  return useQuery({
    queryKey: ["studentCourseStatuses", userId, studyPlanId],
    queryFn: async () => {
      let statusMap = new Map<number, "approved" | "failed" | "not_taken" | "withdrawn" | "in_progress">();

      if (!userId || !studyPlanId) {
        const localChanges = getLocalCourseStatusChanges();
        for (const change of localChanges) {
          if (change.studyPlanId === studyPlanId) {
            statusMap.set(change.courseId, change.status);
          }
        }
        return statusMap;
      }

      const sb = getSupabaseBrowserClient();

      const { data, error } = await sb.rpc("get_user_course_effective_statuses", {
        p_user_id: userId,
        p_study_plan_id: studyPlanId,
      });

      if (error) throw error;

      for (const record of (data ?? []) as Array<{ course_id: number; status: string }>) {
        statusMap.set(record.course_id, record.status.toLowerCase() as "approved" | "failed" | "withdrawn" | "in_progress");
      }

      const localChanges = getLocalCourseStatusChanges();
      for (const change of localChanges) {
        if (change.studyPlanId === studyPlanId) {
          statusMap.set(change.courseId, change.status);
        }
      }

      return statusMap;
    },
    enabled: true,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCourseAttempt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      userId: string;
      studyPlanId: number;
      courseId: number;
      status: "approved" | "failed" | "withdrawn" | "in_progress";
      grade: number | null;
      academicTermId?: number | null;
    }) => {
      const sb = getSupabaseBrowserClient();

      const { error } = await sb.rpc("insert_student_course_attempt", {
        p_user_id: params.userId,
        p_study_plan_id: params.studyPlanId,
        p_course_id: params.courseId,
        p_status: params.status.toUpperCase(),
        p_grade: params.grade,
        p_academic_term_id: params.academicTermId ?? null,
      });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["studentCourseStatuses", variables.userId, variables.studyPlanId] })
      queryClient.invalidateQueries({ queryKey: ["scheduleCourses"] })
      queryClient.invalidateQueries({ queryKey: ["dashboardStats", variables.userId, variables.studyPlanId] })
      queryClient.invalidateQueries({ queryKey: ["courseAttempts", variables.userId, variables.studyPlanId, variables.courseId] })
    },
  });
}

export function useUpdateCourseAttempt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      userId: string;
      studyPlanId: number;
      courseId: number;
      attemptId: number;
      grade: number | null;
      academicTermId: number;
    }) => {
      const sb = getSupabaseBrowserClient();

      const { error } = await sb.rpc("update_student_course_attempt", {
        p_attempt_id: params.attemptId,
        p_academic_term_id: params.academicTermId,
        p_grade: params.grade,
      });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["studentCourseStatuses", variables.userId, variables.studyPlanId] });
      queryClient.invalidateQueries({ queryKey: ["scheduleCourses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats", variables.userId, variables.studyPlanId] });
      queryClient.invalidateQueries({ queryKey: ["courseAttempts", variables.userId, variables.studyPlanId, variables.courseId] });
    },
  });
}

export function useCourseAttempts(userId: string | null, studyPlanId: number | null, courseId: number | null) {
  return useQuery({
    queryKey: ["courseAttempts", userId, studyPlanId, courseId],
    queryFn: async () => {
      if (!userId || !studyPlanId || !courseId) return [] as CourseAttempt[];

      const sb = getSupabaseBrowserClient();
      const { data, error } = await sb.rpc("get_student_course_attempts", {
        p_user_id: userId,
        p_study_plan_id: studyPlanId,
        p_course_id: courseId,
      });

      if (error) throw error;

      return (data ?? []).map((attempt: {
        id: number;
        attempt_number: number;
        status: string;
        grade: number | null;
        academic_term_id: number | null;
        recorded_at: string;
      }) => ({
        id: attempt.id,
        attemptNumber: attempt.attempt_number,
        status: attempt.status.toLowerCase() as CourseAttempt["status"],
        grade: attempt.grade,
        academicTermId: attempt.academic_term_id,
        recordedAt: attempt.recorded_at,
      } satisfies CourseAttempt));
    },
    enabled: !!userId && !!studyPlanId && !!courseId,
    staleTime: 30 * 1000,
  });
}

export function useCoursesByIds(courseIds: number[] | null) {
  return useQuery({
    queryKey: ["coursesByIds", courseIds],
    queryFn: async () => {
      if (!courseIds || courseIds.length === 0) return [];

      const sb = getSupabaseBrowserClient();

      const { data, error } = await sb
        .from("course")
        .select("id, code, name, status")
        .in("id", courseIds);

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!courseIds && courseIds.length > 0,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCourseEquivalents(studyPlanId: number | null, fromCourseId: number | null, page: number = 0, limit: number = 10) {
  return useQuery({
    queryKey: ["courseEquivalents", studyPlanId, fromCourseId, page, limit],
    queryFn: async () => {
      if (!studyPlanId || !fromCourseId) return { data: [], totalCount: 0 };

      const sb = getSupabaseBrowserClient();

      const { data, error } = await sb.rpc("get_course_equivalents_for_plan", {
        p_study_plan_id: studyPlanId,
        p_from_course_id: fromCourseId,
        p_limit: limit,
        p_offset: page * limit,
      });

      if (error) throw error;

      const equivalents: Array<{
        id: number
        code: string | null
        name: string | null
        credits: number | null
        weeklyHours: number | null
        totalCount: number
      }> = (data ?? []).map((item: {
        to_course_id: number
        to_course_code: string | null
        to_course_name: string | null
        to_course_credits: number | null
        to_course_weekly_hours: number | null
        total_count: number | null
      }) => ({
        id: item.to_course_id,
        code: item.to_course_code,
        name: item.to_course_name,
        credits: item.to_course_credits,
        weeklyHours: item.to_course_weekly_hours,
        totalCount: item.total_count ?? 0,
      }));

      const totalCount = equivalents.length > 0 ? equivalents[0].totalCount : 0;

      return {
        data: equivalents,
        totalCount,
      };
    },
    enabled: !!studyPlanId && !!fromCourseId,
    placeholderData: (previous) => previous,
  });
}

export function useCourseRecentProfessors(
  courseId: number | null,
  campusId: number | null,
  academicUnitId: number | null,
) {
  return useQuery({
    queryKey: ["courseRecentProfessors", courseId, campusId, academicUnitId],
    queryFn: async () => {
      if (!courseId) return [] as CourseRecentProfessor[];

      const sb = getSupabaseBrowserClient();
      const { data, error } = await sb.rpc("get_course_recent_professors", {
        p_course_id: courseId,
        p_campus_id: campusId,
        p_academic_unit_id: academicUnitId,
        p_year_window: 2,
      });

      if (error) throw error;

      return (data ?? []).map((row: {
        professor_id: number;
        professor_name: string;
        last_taught_term_id: number;
        last_taught_term_name: string;
        last_taught_year: number;
        last_taught_period_number: number;
        groups_in_last_term_count: number;
        terms_taught_count: number;
      }) => ({
        professorId: row.professor_id,
        professorName: row.professor_name,
        lastTaughtTermId: row.last_taught_term_id,
        lastTaughtTermName: row.last_taught_term_name,
        lastTaughtYear: row.last_taught_year,
        lastTaughtPeriodNumber: row.last_taught_period_number,
        groupsInLastTermCount: row.groups_in_last_term_count,
        termsTaughtCount: row.terms_taught_count,
      } satisfies CourseRecentProfessor));
    },
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCourseLatestTermGroups(
  courseId: number | null,
  campusId: number | null,
  academicUnitId: number | null,
) {
  return useQuery({
    queryKey: ["courseLatestTermGroups", courseId, campusId, academicUnitId],
    queryFn: async () => {
      if (!courseId) return [] as CourseLatestTermGroup[];

      const sb = getSupabaseBrowserClient();
      const { data, error } = await sb.rpc("get_course_latest_term_groups", {
        p_course_id: courseId,
        p_campus_id: campusId,
        p_academic_unit_id: academicUnitId,
      });

      if (error) throw error;

      return (data ?? []).map((row: {
        academic_term_id: number;
        term_display_name: string;
        term_year: number;
        term_period_number: number;
        group_id: number;
        group_code: string;
        group_type: string;
        capacity: number;
        campus_id: number | null;
        campus_name: string | null;
        professors: Array<{ id: number; name: string }> | null;
        meetings: Array<{ weekday: number; starts_at: string; ends_at: string; classroom: string | null }> | null;
      }) => ({
        academicTermId: row.academic_term_id,
        termDisplayName: row.term_display_name,
        termYear: row.term_year,
        termPeriodNumber: row.term_period_number,
        groupId: row.group_id,
        groupCode: row.group_code,
        groupType: row.group_type,
        capacity: row.capacity,
        campusId: row.campus_id,
        campusName: row.campus_name,
        professors: row.professors ?? [],
        meetings: row.meetings ?? [],
      } satisfies CourseLatestTermGroup));
    },
    enabled: !!courseId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useDashboardStats(userId: string | null, studyPlanId: number | null) {
  return useQuery({
    queryKey: ["dashboardStats", userId, studyPlanId],
    queryFn: async () => {
      if (!userId || !studyPlanId) return null;

      const sb = getSupabaseBrowserClient();

      const { data, error } = await sb.rpc("get_user_dashboard_stats", {
        p_user_id: userId,
        p_study_plan_id: studyPlanId,
      });

      if (error) throw error;

      return data as {
        stats: DashboardStats;
        semesters: SemesterProgress[];
        nextCourses: NextCourse[];
      } | null;
    },
    enabled: !!userId && !!studyPlanId,
    staleTime: 30 * 1000,
  });
}
