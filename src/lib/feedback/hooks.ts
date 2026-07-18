import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  submitFeedback,
  getFeedbackList,
  markFeedbackAsReviewed,
  type SubmitFeedbackPayload,
} from "./api";

export function useSubmitFeedback() {
  return useMutation({
    mutationFn: (payload: SubmitFeedbackPayload) => submitFeedback(payload),
  });
}

export function useFeedbackList(limit: number, offset: number) {
  return useQuery({
    queryKey: ["feedback", limit, offset],
    queryFn: () => getFeedbackList(limit, offset),
  });
}

export function useMarkFeedbackAsReviewed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => markFeedbackAsReviewed(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["feedback"] });
      void queryClient.invalidateQueries({ queryKey: ["moderationCounts"] });
      toast.success("Marcado como revisado");
    },
    onError: () => {
      toast.error("Error al marcar como revisado");
    },
  });
}
