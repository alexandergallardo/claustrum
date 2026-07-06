import { createFileRoute, redirect } from "@tanstack/react-router";

import { buildSeoMeta } from "@/lib/seo";

import {
  CURRICULUM_DEFAULT_UNIVERSITY_ID,
  hasLegacyCurriculumSearchParams,
  parseCurriculumSearch,
  toCurriculumUrlSearch,
} from "./-curriculum-search";

export const Route = createFileRoute("/curriculum/")({
  head: () =>
    buildSeoMeta({
      title: "Planes de Estudio TEC (ITCR) | Claustrum",
      description:
        "Explora los planes de estudio del Tecnológico de Costa Rica. Revisa cursos, requisitos y malla curricular de tu carrera.",
      breadcrumbName: "Planes de Estudio",
      urlPath: "/curriculum",
    }),
  validateSearch: parseCurriculumSearch,
  search: {
    middlewares: [
      ({ search, next }) => toCurriculumUrlSearch(next(search)) as unknown as typeof search,
    ],
  },
  beforeLoad: ({ search, location }) => {
    if (
      hasLegacyCurriculumSearchParams(location.searchStr) ||
      (search.university !== undefined && search.university !== CURRICULUM_DEFAULT_UNIVERSITY_ID)
    ) {
      throw redirect({
        to: "/curriculum",
        search: toCurriculumUrlSearch({
          ...search,
          university: undefined,
        }) as unknown as typeof search,
        replace: true,
      });
    }
  },
});
