import { useQuery } from "@tanstack/react-query";

import { getEvaluationModerationQueue } from "@/lib/evaluations/api";
import { getProfessorReviewsForModeration } from "@/lib/professor-reviews/api";

export type ModerationCounts = {
  pendingReviews: number;
  pendingEvaluations: number;
};

export function useModerationCounts(enabled = true) {
  return useQuery({
    queryKey: ["moderationCounts"],
    queryFn: async (): Promise<ModerationCounts> => {
      const [reviews, evaluations] = await Promise.all([
        getProfessorReviewsForModeration("pending", 0, 0),
        getEvaluationModerationQueue("pending", 0, 0),
      ]);
      return {
        pendingReviews: reviews[0]?.total_count ?? 0,
        pendingEvaluations: evaluations[0]?.total_count ?? 0,
      };
    },
    enabled,
    staleTime: 30_000,
  });
}
