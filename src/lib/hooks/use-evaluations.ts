import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getCourseEvaluations,
  getEvaluationModerationQueue,
  moderateEvaluation,
  uploadEvaluation,
} from "@/lib/evaluations/api";
import type { EvaluationStatus, UploadEvaluationPayload } from "@/lib/evaluations/types";

export function useCourseEvaluations(courseId: number | null) {
  return useQuery({
    queryKey: ["courseEvaluations", courseId],
    queryFn: () => getCourseEvaluations(courseId!),
    enabled: courseId !== null,
  });
}

export function useUploadEvaluation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UploadEvaluationPayload) => uploadEvaluation(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["courseEvaluations", variables.courseId] });
      queryClient.invalidateQueries({ queryKey: ["evaluationModerationQueue"] });
    },
  });
}

export function useEvaluationModerationQueue(
  status: EvaluationStatus,
  page: number,
  pageSize: number,
) {
  return useQuery({
    queryKey: ["evaluationModerationQueue", status, page, pageSize],
    queryFn: () => getEvaluationModerationQueue(status, pageSize, page * pageSize),
    placeholderData: (previousData) => previousData,
  });
}

export function useModerateEvaluation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { evaluationId: number; status: "approved" | "rejected"; note: string }) =>
      moderateEvaluation(variables.evaluationId, variables.status, variables.note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluationModerationQueue"] });
      queryClient.invalidateQueries({ queryKey: ["courseEvaluations"] });
    },
  });
}
