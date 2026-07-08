import { useQuery } from "@tanstack/react-query";

import { getEvaluationModerationQueue } from "@/lib/evaluations/api";
import {
  getProfessorReviewReportsForModeration,
  getProfessorReviewsForModeration,
} from "@/lib/professor-reviews/api";

export type ModerationCounts = {
  pendingReviews: number;
  pendingEvaluations: number;
  pendingReviewReports: number;
};

export function useModerationCounts(enabled = true) {
  return useQuery({
    queryKey: ["moderationCounts"],
    queryFn: async (): Promise<ModerationCounts> => {
      const [reviews, evaluations, reviewReports] = await Promise.all([
        getProfessorReviewsForModeration("pending", 1, 0),
        getEvaluationModerationQueue("pending", 1, 0),
        getProfessorReviewReportsForModeration("pending", 1, 0),
      ]);
      return {
        pendingReviews: reviews[0]?.total_count ?? 0,
        pendingEvaluations: evaluations[0]?.total_count ?? 0,
        pendingReviewReports: reviewReports[0]?.total_count ?? 0,
      };
    },
    enabled,
    staleTime: 30_000,
  });
}
