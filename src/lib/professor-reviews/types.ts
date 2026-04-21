export const REVIEW_TAG_OPTIONS = [
  "Da buena retroalimentación",
  "Tomaría su clase nuevamente",
  "Brinda apoyo",
  "Explica con claridad",
  "Exámenes retadores",
  "Proyecto útil",
] as const;

export type ReviewTag = (typeof REVIEW_TAG_OPTIONS)[number];

export type ProfessorReviewStatus = "pending" | "approved" | "rejected";

export type ProfessorReviewStatsRow = {
  professor_id: number;
  professor_name: string;
  approved_review_count: number;
  average_overall_score: number | null;
  average_ease_score: number | null;
  average_quality_score: number | null;
  average_clarity_score: number | null;
  courses_reviewed_count: number;
  last_approved_review_at: string | null;
  search_rank: number;
  total_count: number;
};

export type ProfessorReviewPublicRow = {
  review_id: number;
  professor_id: number;
  course_id: number;
  course_code: string;
  course_name: string;
  comment: string;
  ease_score: number | null;
  quality_score: number | null;
  clarity_score: number | null;
  fairness_score: number | null;
  attendance_required: boolean | null;
  grade_received: string | null;
  engagement_level: number | null;
  tags: string[];
  status: ProfessorReviewStatus;
  created_at: string;
  total_count: number;
};

export type ProfessorReviewModerationRow = {
  review_id: number;
  professor_id: number;
  professor_name: string;
  course_id: number;
  course_code: string;
  course_name: string;
  comment: string;
  ease_score: number;
  quality_score: number;
  clarity_score: number;
  fairness_score: number;
  attendance_required: boolean;
  grade_received: string | null;
  engagement_level: number;
  tags: string[];
  status: ProfessorReviewStatus;
  created_at: string;
  reviewed_at: string | null;
  moderation_note: string | null;
  total_count: number;
};

export type ProfessorReviewTagCount = {
  tag: string;
  count: number;
};

export type ProfessorReviewCourseOption = {
  id: number;
  code: string;
  name: string;
};

export type ProfessorReviewSummary = {
  professor_id: number;
  approved_review_count: number;
  average_overall_score: number | null;
  average_ease_score: number | null;
  average_quality_score: number | null;
  average_clarity_score: number | null;
  average_fairness_score: number | null;
  would_take_again_percentage: number | null;
  tag_counts: ProfessorReviewTagCount[];
};

export type SearchProfessorReviewStatsParams = {
  query: string;
  minAverageScore: number | null;
  minReviewCount: number;
  courseCode: string;
  onlyWithApprovedReviews: boolean;
  limit: number;
  offset: number;
};

export type SubmitProfessorReviewPayload = {
  professorId: number;
  courseCode: string;
  comment: string;
  easeScore: number;
  qualityScore: number;
  clarityScore: number;
  fairnessScore: number;
  attendanceRequired: boolean;
  gradeReceived?: string;
  engagementLevel: number;
  tags: ReviewTag[];
  turnstileToken: string;
};
