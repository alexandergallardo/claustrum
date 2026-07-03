import { createFileRoute } from "@tanstack/react-router";

type ProfessorsSearchInput = Record<string, unknown>;

export interface ProfessorsSearch {
  q?: string;
  ms?: string;
  mc?: string;
  cc?: string;
}

export const Route = createFileRoute("/professors/")({
  validateSearch: (search: ProfessorsSearchInput): ProfessorsSearch => {
    return {
      q: typeof search.q === "string" ? search.q : undefined,
      ms: typeof search.ms === "string" ? search.ms : undefined,
      mc: typeof search.mc === "string" ? search.mc : undefined,
      cc: typeof search.cc === "string" ? search.cc : undefined,
    };
  },
});
