// Database types based on Supabase schema

export interface CatalogUniversity {
  id: number
  name: string
  shortName: string
  countryId: number
  createdAt: string
  updatedAt: string
}

export interface CatalogCampus {
  id: number
  name: string
  code: string
  universityId: number
  isActive: boolean
  openedOn?: string
  closedOn?: string
  createdAt: string
  updatedAt: string
}

export interface CatalogDepartment {
  id: number
  name: string
  code: string
  universityId: number
  offersCareers: boolean
  createdAt: string
  updatedAt: string
}

export interface CatalogCareerProgram {
  id: number
  academicUnitId: number
  code: string
  name: string
}

export interface CatalogStudyPlan {
  id: number
  name: string
  academicDegree?: string
  careerProgramId: number
  academicModalityId: number
  externalPlanId: number
  firstLevelNumber: number
  createdAt: string
  updatedAt: string
}

export interface StudyPlanCourse {
  courseId: number
  levelNumber: number | null
  credits: number
  weeklyHours: number
  sortOrder: number
  courseCode: string
  courseName: string
  courseDefaultCredits: number
  courseDefaultWeeklyHours: number
}

export interface StudyPlanCoursesResponse {
  courses: StudyPlanCourse[]
}

export interface CoursePrerequisitesResponse {
  prerequisites: number[]
  corequisites: number[]
}

export interface CoursePrerequisitesResponse {
  prerequisites: number[]
  corequisites: number[]
}

export interface StudyPeriod {
  levelNumber: number | null
  courses: StudyPlanCourse[]
}

export interface StudyPlanDetail {
  plan: CatalogStudyPlan
  periods: StudyPeriod[]
  courseRelations: Map<number, {
    prerequisites: number[]
    corequisites: number[]
  }>
}

export interface UserStudyPlanContext {
  userStudyPlanId: number
  studyPlanId: number
  campusId: number
  entryYear: number
  studyPlanName: string
  campusName: string
  universityId: number | null
  departmentId: number | null
  academicUnitId: number | null
}

export interface UserProfileContextRow {
  user_id: string
  carnet: string | null
  university_id: number | null
  university_name: string | null
  campus_id: number | null
  campus_name: string | null
  academic_unit_id: number | null
  academic_unit_name: string | null
  career_program_id: number | null
  career_program_name: string | null
  study_plan_id: number | null
  study_plan_name: string | null
  user_study_plan_id: number | null
  entry_year: number | null
}
