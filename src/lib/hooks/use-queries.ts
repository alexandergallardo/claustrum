import { useQuery, useMutation, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import type { AcademicTerm } from "@/lib/types";

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
    queryKey: ["studyPlans", academicUnitId],
    queryFn: async () => {
      if (!academicUnitId) return [];
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
      const sb = getSupabaseBrowserClient();
      const { data, error } = await sb
        .rpc("get_study_plans_for_academic_unit", { p_academic_unit_id: academicUnitId })
        .select("id,academic_unit_id,external_plan_id,name,academic_degree");
      if (error) throw error;
      return (data ?? []) as StudyPlanRow[];
    },
    enabled: !!academicUnitId,
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

export type StudyPlanRow = {
  id: number;
  academic_unit_id: number;
  external_plan_id: number;
  name: string;
  academic_degree: string | null;
};

export type UserProfileContextRow = {
  user_id: string;
  carnet: string | null;
  university_id: number | null;
  university_name: string | null;
  campus_id: number | null;
  campus_name: string | null;
  academic_unit_id: number | null;
  academic_unit_name: string | null;
  study_plan_id: number | null;
  study_plan_name: string | null;
  entry_year: number | null;
};

export type StudyPeriod = {
  levelNumber: number;
  courses: StudyPlanCourse[];
};

export type StudyPlanCourse = {
  courseId: number;
  levelNumber: number;
  credits: number;
  weeklyHours: number;
  sortOrder: number;
  courseCode: string;
  courseName: string;
  courseDefaultCredits: number;
  courseDefaultWeeklyHours: number;
};

export type CourseRelation = {
  fromCourseId: number;
  toCourseId: number;
  relationType: 'PREREQUISITE' | 'COREQUISITE' | 'EQUIVALENT';
};

export type StudentCourseStatusMap = Map<number, "approved" | "failed" | "not_taken" | "withdrawn" | "in_progress">;

export type StudyPlanDetail = {
  plan: StudyPlanRow;
  periods: StudyPeriod[];
  courseRelations: Map<number, { prerequisites: number[]; corequisites: number[]; equivalents: number[] }>;
};

export function useStudyPlanDetail(planId: number | null, selectedPlanData: StudyPlanRow | undefined) {
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

      const periods = new Map<number | null, StudyPlanCourse[]>();
      for (const item of coursesResult.data ?? []) {
        const course: StudyPlanCourse = {
          courseId: item.course_id,
          levelNumber: item.level_number,
          credits: item.credits,
          weeklyHours: item.weekly_hours,
          sortOrder: item.sort_order,
          courseCode: item.course_code,
          courseName: item.course_name,
          courseDefaultCredits: item.default_credits,
          courseDefaultWeeklyHours: item.default_weekly_hours,
        };
        const level = item.level_number ?? 0;
        if (!periods.has(level)) {
          periods.set(level, []);
        }
        periods.get(level)!.push(course);
      }

      const periodArray = Array.from(periods.entries())
        .sort(([a], [b]) => (a ?? 0) - (b ?? 0))
        .map(([levelNumber, courses]): StudyPeriod => ({
          levelNumber: levelNumber ?? 0,
          courses,
        }));

      return {
        plan: selectedPlanData ?? { id: planId, academic_unit_id: 0, external_plan_id: 0, name: "", academic_degree: null },
        periods: periodArray,
        courseRelations,
      } as StudyPlanDetail;
    },
    enabled: !!planId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserStudyPlan() {
  return useQuery({
    queryKey: ["userStudyPlan"],
    queryFn: async () => {
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
      const sb = getSupabaseBrowserClient();
      const { data: { user }, error: authError } = await sb.auth.getUser();
      if (authError || !user) return null;

      const { data, error } = await sb
        .rpc("get_user_profile_with_context", { p_user_id: user.id })
        .select("*")
        .maybeSingle();

      if (error) throw error;
      const profile = data as UserProfileContextRow | null;
      if (!profile || !profile.study_plan_id) return null;

      return {
        universityId: profile.university_id,
        campusId: profile.campus_id,
        academicUnitId: profile.academic_unit_id,
        studyPlanId: profile.study_plan_id,
      };
    },
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
  includeOtherCampuses: boolean;
}) {
  const { termId, campusId, careerId, includeOtherCampuses } = params;

  return useQuery({
    queryKey: ["scheduleCourses", termId, campusId, careerId, includeOtherCampuses],
    queryFn: async () => {
      if (!termId || !campusId) return null;
      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
      const sb = getSupabaseBrowserClient();
      const { data: { user } } = await sb.auth.getUser();

      let data, error;

      if (user) {
        ({ data, error } = await sb
          .rpc("get_user_schedule_courses", {
            p_user_id: user.id,
            p_academic_term_id: termId,
            p_campus_id: campusId,
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
    enabled: !!termId && !!campusId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useStudentCourseStatuses(userId: string | null, studyPlanId: number | null) {
  return useQuery({
    queryKey: ["studentCourseStatuses", userId, studyPlanId],
    queryFn: async () => {
      if (!userId || !studyPlanId) return new Map<number, "approved" | "failed" | "not_taken" | "withdrawn" | "in_progress">();

      const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
      const sb = getSupabaseBrowserClient();

      const { data, error } = await sb
        .from("student_course_record")
        .select("course_id, status")
        .eq("user_id", userId)
        .eq("study_plan_id", studyPlanId);

      if (error) throw error;

      const statusMap = new Map<number, "approved" | "failed" | "not_taken" | "withdrawn" | "in_progress">();
      for (const record of data ?? []) {
        statusMap.set(record.course_id, record.status.toLowerCase() as any);
      }
      return statusMap;
    },
    enabled: !!userId && !!studyPlanId,
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
      queryClient.invalidateQueries({ queryKey: ["studentCourseStatuses", variables.userId, variables.studyPlanId] });
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
