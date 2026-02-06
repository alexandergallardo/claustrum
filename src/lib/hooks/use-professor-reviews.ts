import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getCurrentUserIsAdmin,
  getProfessorById,
  getProfessorReviewSummary,
  getProfessorReviewsForModeration,
  getProfessorReviewsPublic,
  moderateProfessorReview,
  searchProfessorReviewStats,
  submitProfessorReview,
} from "@/lib/professor-reviews/api";
import type {
  ProfessorReviewStatus,
  SearchProfessorReviewStatsParams,
  SubmitProfessorReviewPayload,
} from "@/lib/professor-reviews/types";

export function useProfessorReviewStats(params: SearchProfessorReviewStatsParams) {
  return useQuery({
    queryKey: ["professorReviewStats", params],
    queryFn: () => searchProfessorReviewStats(params),
    placeholderData: keepPreviousData,
  });
}

export function useProfessorReviewsPublic(professorId: number | null, page: number, pageSize: number) {
  return useQuery({
    queryKey: ["professorReviewsPublic", professorId, page, pageSize],
    queryFn: () => getProfessorReviewsPublic(professorId!, pageSize, page * pageSize),
    enabled: professorId !== null,
    placeholderData: (previousData) => previousData,
  });
}

export function useProfessorReviewSummary(professorId: number | null) {
  return useQuery({
    queryKey: ["professorReviewSummary", professorId],
    queryFn: () => getProfessorReviewSummary(professorId!),
    enabled: professorId !== null,
  });
}

export function useProfessorById(professorId: number | null) {
  return useQuery({
    queryKey: ["professorById", professorId],
    queryFn: () => getProfessorById(professorId!),
    enabled: professorId !== null,
  });
}

export function useSubmitProfessorReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitProfessorReviewPayload) => submitProfessorReview(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professorReviewStats"] });
    },
  });
}

export function useIsAdmin() {
  return useQuery({
    queryKey: ["isAdmin"],
    queryFn: getCurrentUserIsAdmin,
    staleTime: 60_000,
  });
}

export function useModerationQueue(status: ProfessorReviewStatus, page: number, pageSize: number) {
  return useQuery({
    queryKey: ["professorModerationQueue", status, page, pageSize],
    queryFn: () => getProfessorReviewsForModeration(status, pageSize, page * pageSize),
    placeholderData: (previousData) => previousData,
  });
}

export function useModerateProfessorReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { reviewId: number; status: "approved" | "rejected"; note: string }) =>
      moderateProfessorReview(variables.reviewId, variables.status, variables.note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professorModerationQueue"] });
      queryClient.invalidateQueries({ queryKey: ["professorReviewStats"] });
      queryClient.invalidateQueries({ queryKey: ["professorReviewsPublic"] });
    },
  });
}
