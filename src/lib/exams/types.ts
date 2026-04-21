export type ExamType = "parcial_1" | "parcial_2" | "parcial_3" | "quizz" | "final" | "tarea" | "proyecto" | "otro";
export type ExamStatus = "pending" | "approved" | "rejected";

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  parcial_1: "Parcial 1",
  parcial_2: "Parcial 2",
  parcial_3: "Parcial 3",
  quizz: "Quizz",
  final: "Final",
  tarea: "Tarea",
  proyecto: "Proyecto",
  otro: "Otro",
};

export interface CourseExam {
  id: number;
  course_id: number;
  academic_term_id: number | null;
  professor_id: number | null;
  uploaded_by: string;
  exam_type: ExamType;
  is_catedra: boolean;
  includes_answers: boolean;
  has_separate_answers: boolean;
  exam_file_key: string;
  exam_file_size: number;
  answers_file_key: string | null;
  status: ExamStatus;
  created_at: string;
  term_display_name: string | null;
  professor_name: string | null;
}

export interface ExamUploadPayload {
  courseId: number;
  academicTermId: number | null;
  professorId: number | null;
  examType: ExamType;
  isCatedra: boolean;
  includesAnswers: boolean;
  hasSeparateAnswers: boolean;
  examFile: File;
  answersFile?: File;
}

export interface ExamModerationRow {
  id: number;
  course_id: number;
  course_code: string;
  course_name: string;
  academic_term_id: number | null;
  term_display_name: string | null;
  professor_id: number | null;
  professor_name: string | null;
  uploaded_by: string;
  uploader_email: string | null;
  exam_type: ExamType;
  is_catedra: boolean;
  includes_answers: boolean;
  has_separate_answers: boolean;
  exam_file_key: string;
  exam_file_size: number;
  answers_file_key: string | null;
  status: ExamStatus;
  moderation_note: string | null;
  created_at: string;
  total_count: number;
}
