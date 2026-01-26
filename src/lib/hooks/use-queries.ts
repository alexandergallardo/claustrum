import { useQuery, useMutation, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import type { AcademicTerm, StudyPeriod, CatalogStudyPlan, StudyPlanCourse, StudyPlanDetail, UserProfileContextRow, DashboardStats, SemesterProgress, NextCourse } from "@/lib/types";
import { getLocalCourseStatusChanges } from "@/lib/utils/local-storage-utils";

export function useUniversities() {
  return useQuery({
    queryKey: ["universities"],
    queryFn: async () => {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
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
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
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
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
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

      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
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
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
      const sb = getSupabaseBrowserClient();
      const { data, error } = await sb
        .rpc("get_user_profile_with_context", { p_user_id: userId })
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as UserProfileContextRow | null;
    },
    enabled: !!userId,
    placeholderData: null,
  });
}

export function useAuthUser() {
  return useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
      const sb = getSupabaseBrowserClient();
      const { data, error } = await sb.auth.getUser();
      if (error) return null;
      return data.user;
    },
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
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
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
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
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
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
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
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
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
      showAllCourses,
      userId,
    ],
    queryFn: async () => {
      if (!termId || !campusId) return null;
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
      const sb = getSupabaseBrowserClient();

      let data, error;

      if (userId) {
        ({ data, error } = await sb
          .rpc("get_eligible_schedule_courses", {
            p_user_id: userId,
            p_academic_term_id: termId,
            p_campus_id: campusId,
            p_include_other_campuses: includeOtherCampuses,
            p_show_all_courses: showAllCourses,
          })
          .select("*"));
      } else if (planId) {
        ({ data, error } = await sb
          .rpc("get_schedule_courses_by_study_plan", {
            p_academic_term_id: termId,
            p_campus_id: campusId,
            p_study_plan_id: planId,
            p_include_other_campuses: includeOtherCampuses,
          })
          .select("*"));
      } else if (careerId) {
        ({ data, error } = await sb
          .rpc("get_schedule_courses_by_academic_unit", {
            p_academic_term_id: termId,
            p_campus_id: campusId,
            p_academic_unit_id: careerId,
            p_include_other_campuses: includeOtherCampuses,
          })
          .select("*"));
      } else {
        return null;
      }

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
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
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

      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
      const sb = getSupabaseBrowserClient();

      const { data, error } = await sb
        .from("student_course_record")
        .select("course_id, status")
        .eq("user_id", userId)
        .eq("study_plan_id", studyPlanId);

      if (error) throw error;

      for (const record of data ?? []) {
        statusMap.set(record.course_id, record.status.toLowerCase() as any);
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

export function useUpdateCourseStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      userId: string;
      studyPlanId: number;
      courseId: number;
      status: "approved" | "failed" | "not_taken" | "withdrawn" | "in_progress";
    }) => {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
      const sb = getSupabaseBrowserClient();

      let error;

      if (params.status === "not_taken") {
        ({ error } = await sb.rpc("delete_student_course_status", {
          p_user_id: params.userId,
          p_study_plan_id: params.studyPlanId,
          p_course_id: params.courseId,
        }));
      } else {
        ({ error } = await sb.rpc("update_student_course_status", {
          p_user_id: params.userId,
          p_study_plan_id: params.studyPlanId,
          p_course_id: params.courseId,
          p_status: params.status.toUpperCase() as any,
        }));
      }

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["studentCourseStatuses", variables.userId, variables.studyPlanId] })
      queryClient.invalidateQueries({ queryKey: ["scheduleCourses"] })
    },
  });
}

export function useCoursesByIds(courseIds: number[] | null) {
  return useQuery({
    queryKey: ["coursesByIds", courseIds],
    queryFn: async () => {
      if (!courseIds || courseIds.length === 0) return [];

      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
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

      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
      const sb = getSupabaseBrowserClient();

      const { data, error } = await sb.rpc("get_course_equivalents_for_plan", {
        p_study_plan_id: studyPlanId,
        p_from_course_id: fromCourseId,
        p_limit: limit,
        p_offset: page * limit,
      });

      if (error) throw error;

      const equivalents: Array<{ id: number; code: string | null; name: string | null; totalCount: number }> = (data ?? []).map((item: { to_course_id: number; to_course_code: string | null; to_course_name: string | null; total_count: number | null }) => ({
        id: item.to_course_id,
        code: item.to_course_code,
        name: item.to_course_name,
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

export function useDashboardStats(userId: string | null, studyPlanId: number | null) {
  return useQuery({
    queryKey: ["dashboardStats", userId, studyPlanId],
    queryFn: async () => {
      if (!userId || !studyPlanId) return null;

      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
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
