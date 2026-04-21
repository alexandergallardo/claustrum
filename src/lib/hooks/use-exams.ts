import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCourseExams,
  getExamModerationQueue,
  moderateExam,
  deleteExam,
  uploadExam,
  getExamDownloadUrl,
} from "@/lib/exams/api";
import type { ExamStatus } from "@/lib/exams/types";

export function useCourseExams(courseId: number | null) {
  return useQuery({
    queryKey: ["courseExams", courseId],
    queryFn: () => getCourseExams(courseId!),
    enabled: courseId !== null,
  });
}

export function useExamModerationQueue(status: ExamStatus, page: number, pageSize: number) {
  return useQuery({
    queryKey: ["examModerationQueue", status, page, pageSize],
    queryFn: () => getExamModerationQueue(status, pageSize, page * pageSize),
    placeholderData: (previousData) => previousData,
  });
}

export function useModerateExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { examId: number; status: "approved" | "rejected"; note: string }) =>
      moderateExam(variables.examId, variables.status, variables.note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examModerationQueue"] });
      queryClient.invalidateQueries({ queryKey: ["courseExams"] });
    },
  });
}

export function useDeleteExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteExam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["examModerationQueue"] });
      queryClient.invalidateQueries({ queryKey: ["courseExams"] });
    },
  });
}

export function useUploadExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadExam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courseExams"] });
    },
  });
}

export function useExamDownloadUrl(fileKey: string | null) {
  return useQuery({
    queryKey: ["examDownloadUrl", fileKey],
    queryFn: () => getExamDownloadUrl(fileKey!),
    enabled: fileKey !== null,
    staleTime: 3000,
  });
}
