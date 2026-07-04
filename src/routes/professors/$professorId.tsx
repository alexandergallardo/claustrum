import { createFileRoute } from "@tanstack/react-router";

type ProfessorDetailSearchInput = Record<string, unknown>;

export interface ProfessorDetailSearch {
  page?: number;
}

export const Route = createFileRoute("/professors/$professorId")({
  validateSearch: (search: ProfessorDetailSearchInput): ProfessorDetailSearch => {
    return {
      page: search.page !== undefined ? Number(search.page) : undefined,
    };
  },
});
