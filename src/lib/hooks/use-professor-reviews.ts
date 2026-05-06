import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  ProfessorReviewStatus,
  SearchProfessorReviewStatsParams,
  SubmitProfessorReviewPayload,
} from "@/lib/professor-reviews/types";

import {
  getCurrentUserIsAdmin,
  getProfessorById,
  getProfessorReviewSummary,
  getProfessorReviewsForModeration,
  getProfessorReviewsPublic,
  moderateProfessorReview,
  searchProfessorReviewCourses,
  searchProfessorReviewStats,
  submitProfessorReview,
} from "@/lib/professor-reviews/api";

export function useProfessorReviewStats(params: SearchProfessorReviewStatsParams) {
  return useQuery({
    queryKey: ["professorReviewStats", params],
    queryFn: () => searchProfessorReviewStats(params),
    placeholderData: keepPreviousData,
  });
}

export function useProfessorReviewsPublic(
  professorId: number | null,
  page: number,
  pageSize: number,
) {
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

export function useProfessorReviewCourseSearch(query: string) {
  return useQuery({
    queryKey: ["professorReviewCourses", query],
    queryFn: () => searchProfessorReviewCourses(query),
    enabled: query.trim().length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useSubmitProfessorReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitProfessorReviewPayload) => submitProfessorReview(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["professorReviewStats"] });
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
      void queryClient.invalidateQueries({ queryKey: ["professorModerationQueue"] });
      void queryClient.invalidateQueries({ queryKey: ["professorReviewStats"] });
      void queryClient.invalidateQueries({ queryKey: ["professorReviewsPublic"] });
    },
  });
}
