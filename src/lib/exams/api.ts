import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import type { CourseExam, ExamModerationRow, ExamStatus, ExamUploadPayload } from "./types";

export async function getCourseExams(courseId: number): Promise<CourseExam[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("get_course_exams", {
    p_course_id: courseId,
  });
  if (error) throw error;
  return (data ?? []) as CourseExam[];
}

export async function getExamModerationQueue(
  status: ExamStatus,
  limit: number,
  offset: number,
): Promise<ExamModerationRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("get_exam_moderation_queue", {
    p_status: status,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return (data ?? []) as ExamModerationRow[];
}

export async function moderateExam(
  examId: number,
  status: "approved" | "rejected",
  note: string,
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("exam_documents")
    .update({
      status,
      moderation_note: note || null,
      moderated_at: new Date().toISOString(),
    })
    .eq("id", examId);
  if (error) throw error;
}

export async function deleteExam(examId: number): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("exam_documents").delete().eq("id", examId);
  if (error) throw error;
}

export async function uploadExam(payload: ExamUploadPayload): Promise<void> {
  const supabase = getSupabaseBrowserClient();

  const examPath = `exams/${payload.courseId}/${crypto.randomUUID()}.pdf`;
  const { error: examUploadError } = await supabase.storage
    .from("exams")
    .upload(examPath, payload.examFile, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (examUploadError) throw examUploadError;

  let answersPath: string | null = null;
  if (payload.hasSeparateAnswers && payload.answersFile) {
    answersPath = `exams/${payload.courseId}/${crypto.randomUUID()}_answers.pdf`;
    const { error: answersUploadError } = await supabase.storage
      .from("exams")
      .upload(answersPath, payload.answersFile, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (answersUploadError) {
      await supabase.storage.from("exams").remove([examPath]);
      throw answersUploadError;
    }
  }

  const { error: dbError } = await supabase.from("exam_documents").insert({
    course_id: payload.courseId,
    academic_term_id: payload.academicTermId,
    professor_id: payload.professorId,
    exam_type: payload.examType,
    is_catedra: payload.isCatedra,
    includes_answers: payload.includesAnswers,
    has_separate_answers: payload.hasSeparateAnswers,
    exam_file_key: examPath,
    exam_file_size: payload.examFile.size,
    exam_file_sha256: "", // TODO: calcular SHA256
    answers_file_key: answersPath,
    answers_file_size: payload.answersFile?.size ?? null,
    answers_file_sha256: null,
    status: "pending",
  });

  if (dbError) {
    await supabase.storage.from("exams").remove([examPath]);
    if (answersPath) await supabase.storage.from("exams").remove([answersPath]);
    throw dbError;
  }
}

export async function getExamDownloadUrl(fileKey: string): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.storage
    .from("exams")
    .createSignedUrl(fileKey, 3600);
  if (error) throw error;
  return data.signedUrl;
}
