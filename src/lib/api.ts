import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import type {
  CatalogUniversity,
  CatalogCampus,
  CatalogDepartment,
  CatalogCareerProgram,
  CatalogStudyPlan,
  StudyPlanCoursesResponse,
  CoursePrerequisitesResponse,
  UserStudyPlanContext,
  UserProfileContextRow,
} from '@/lib/types'

const supabase = getSupabaseBrowserClient()

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

export async function getUserStudyPlan(): Promise<UserStudyPlanContext | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const { data, error } = await supabase
    .rpc('get_user_profile_with_context', { p_user_id: user.id })
    .single()

  if (error) throw error

  const profile = data as unknown as UserProfileContextRow

  // If no study plan is associated, data might be returned but with null fields
  if (!profile || !profile.study_plan_id) return null

  return {
    userStudyPlanId: profile.user_study_plan_id!,
    studyPlanId: profile.study_plan_id,
    campusId: profile.campus_id!,
    entryYear: profile.entry_year!,
    studyPlanName: profile.study_plan_name!,
    campusName: profile.campus_name!,
    universityId: profile.university_id,
    departmentId: profile.academic_unit_id,
    academicUnitId: profile.academic_unit_id,
  }
}

export async function getAcademicUnitsForCampus(campusId: number): Promise<CatalogCareerProgram[]> {
  const { data, error } = await supabase
    .rpc('get_academic_units_for_campus', { p_campus_id: campusId })

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    id: row.id,
    academicUnitId: row.id,
    code: row.code,
    name: row.name,
  }))
}

export async function getStudyPlansForAcademicUnit(academicUnitId: number): Promise<CatalogStudyPlan[]> {
  const { data, error } = await supabase
    .rpc('get_study_plans_for_academic_unit', { p_academic_unit_id: academicUnitId })

  if (error) throw error

  return (data ?? []).map((plan: any) => ({
    id: plan.id,
    name: plan.name,
    academicDegree: plan.academic_degree,
    academicUnitId: plan.academic_unit_id,
    academicModalityId: 0,
    externalPlanId: plan.external_plan_id,
    firstLevelNumber: 0,
    createdAt: '',
    updatedAt: '',
  }))
}

export async function getUniversities(): Promise<CatalogUniversity[]> {
  const { data, error } = await supabase
    .from('university')
    .select('*')
    .order('name')

  if (error) throw error

  return data.map(univ => ({
    id: univ.id,
    name: univ.name,
    shortName: univ.short_name,
    countryId: univ.country_id,
    createdAt: univ.created_at,
    updatedAt: univ.updated_at,
  }))
}

export async function getCampuses(universityId?: number): Promise<CatalogCampus[]> {
  let query = supabase
    .from('campus')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (universityId) {
    query = query.eq('university_id', universityId)
  }

  const { data, error } = await query

  if (error) throw error

  return data.map(campus => ({
    id: campus.id,
    name: campus.name,
    code: campus.code,
    universityId: campus.university_id,
    isActive: campus.is_active,
    openedOn: campus.opened_on,
    closedOn: campus.closed_on,
    createdAt: campus.created_at,
    updatedAt: campus.updated_at,
  }))
}

export async function getDepartments(
  universityId?: number
): Promise<CatalogDepartment[]> {
  let query = supabase
    .from('academic_unit')
    .select('*')
    .eq('offers_careers', true)
    .order('name')

  if (universityId) {
    query = query.eq('university_id', universityId)
  }

  const { data, error } = await query

  if (error) throw error

  return data.map(dept => ({
    id: dept.id,
    name: dept.name,
    code: dept.code,
    universityId: dept.university_id,
    offersCareers: dept.offers_careers,
    createdAt: dept.created_at,
    updatedAt: dept.updated_at,
  }))
}

export async function getStudyPlans(
  departmentId?: number
): Promise<CatalogStudyPlan[]> {
  // First get career programs that match the filters
  let careerQuery = supabase
    .from('career_program')
    .select('id')

  if (departmentId) {
    careerQuery = careerQuery.eq('academic_unit_id', departmentId)
  }

  const { data: careers, error: careerError } = await careerQuery
  if (careerError) throw careerError

  const careerIds = careers.map(c => c.id)

  // Then get study plans for those careers
  let planQuery = supabase
    .from('study_plan')
    .select('*')
    .in('career_program_id', careerIds)
    .order('name')

  const { data, error } = await planQuery

  if (error) throw error

  return data.map(plan => ({
    id: plan.id,
    name: plan.name,
    academicDegree: plan.academic_degree,
    careerProgramId: plan.career_program_id,
    academicModalityId: plan.academic_modality_id,
    externalPlanId: plan.external_plan_id,
    firstLevelNumber: plan.first_level_number,
    createdAt: plan.created_at,
    updatedAt: plan.updated_at,
  }))
}

export async function getStudyPlanCourses(planId: number): Promise<StudyPlanCoursesResponse> {
  const { data, error } = await supabase
    .rpc('get_study_plan_courses_details', { p_study_plan_id: planId })

  if (error) throw error

  const courses = (data as any[]).map(item => ({
    courseId: item.course_id,
    levelNumber: item.level_number,
    credits: item.credits,
    weeklyHours: item.weekly_hours,
    sortOrder: item.sort_order,
    courseCode: item.course_code,
    courseName: item.course_name,
    courseDefaultCredits: item.default_credits,
    courseDefaultWeeklyHours: item.default_weekly_hours,
  }))

  return { courses }
}

export type StudyPlanCourseRelation = {
  fromCourseId: number
  toCourseId: number
  relationType: 'PREREQUISITE' | 'COREQUISITE' | 'EQUIVALENT'
}

export async function getStudyPlanCourseRelations(planId: number): Promise<StudyPlanCourseRelation[]> {
  const { data, error } = await supabase
    .from('course_relation')
    .select('from_course_id, to_course_id, relation_type')
    .eq('study_plan_id', planId)

  if (error) throw error

  return (data as Array<{ from_course_id: number; to_course_id: number; relation_type: StudyPlanCourseRelation['relationType'] }>).map(r => ({
    fromCourseId: r.from_course_id,
    toCourseId: r.to_course_id,
    relationType: r.relation_type,
  }))
}

export async function getCoursePrerequisites(
  courseId: number,
  planId: number
): Promise<CoursePrerequisitesResponse> {
  const { data, error } = await supabase
    .from('course_relation')
    .select('from_course_id, to_course_id, relation_type')
    .eq('study_plan_id', planId)
    .or(`from_course_id.eq.${courseId},to_course_id.eq.${courseId}`)

  if (error) throw error

  const prerequisites: number[] = []
  const corequisites: number[] = []

  for (const relation of data) {
    // In `course_relation`, `from_course_id` is the dependent course and `to_course_id` is the required course.
    // So prerequisites/corequisites for `courseId` are stored where `from_course_id = courseId`.
    if (relation.from_course_id !== courseId) continue
    if (relation.relation_type === 'PREREQUISITE') {
      prerequisites.push(relation.to_course_id)
    } else if (relation.relation_type === 'COREQUISITE') {
      corequisites.push(relation.to_course_id)
    }
  }

  return { prerequisites, corequisites }
}