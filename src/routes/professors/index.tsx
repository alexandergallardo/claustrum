import { createFileRoute } from "@tanstack/react-router";

import { buildSeoMeta } from "@/lib/seo";

type ProfessorsSearchInput = Record<string, unknown>;

export interface ProfessorsSearch {
  q?: string;
  ms?: string;
  mr?: string;
  au?: string;
  sortBy?: string;
  sortDesc?: boolean;
  page?: number;
}

export const Route = createFileRoute("/professors/")({
  head: () =>
    buildSeoMeta({
      title: "Reseñas de Profesores TEC (ITCR) | Claustrum",
      description:
        "Lee y comparte reseñas de profesores del Tecnológico de Costa Rica para armar el mejor horario.",
      breadcrumbName: "Profesores",
      urlPath: "/professors",
    }),
  validateSearch: (search: ProfessorsSearchInput): ProfessorsSearch => {
    return {
      q: typeof search.q === "string" ? search.q : undefined,
      ms: typeof search.ms === "string" ? search.ms : undefined,
      mr: typeof search.mr === "string" ? search.mr : undefined,
      au: typeof search.au === "string" ? search.au : undefined,
      sortBy: typeof search.sortBy === "string" ? search.sortBy : undefined,
      sortDesc:
        typeof search.sortDesc === "boolean"
          ? search.sortDesc
          : search.sortDesc === "true"
            ? true
            : search.sortDesc === "false"
              ? false
              : undefined,
      page: search.page !== undefined ? Number(search.page) : undefined,
    };
  },
});
