import { useMutation, useQuery } from "@tanstack/react-query";

import { submitFeedback, getFeedbackList, type SubmitFeedbackPayload } from "./api";

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
