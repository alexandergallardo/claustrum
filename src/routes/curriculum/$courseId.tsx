import { createFileRoute, redirect } from "@tanstack/react-router";

import { buildSeoMeta, NOINDEX_ROBOTS } from "@/lib/seo";

import {
  CURRICULUM_DEFAULT_UNIVERSITY_ID,
  hasLegacyCurriculumSearchParams,
  parseCurriculumSearch,
  toCurriculumUrlSearch,
} from "./-curriculum-search";

export const Route = createFileRoute("/curriculum/$courseId")({
  head: () =>
    buildSeoMeta({
      title: "Detalles del Curso | Claustrum",
      robots: NOINDEX_ROBOTS,
    }),
  validateSearch: parseCurriculumSearch,
  search: {
    middlewares: [
      ({ search, next }) => toCurriculumUrlSearch(next(search)) as unknown as typeof search,
    ],
  },
  beforeLoad: ({ search, location, params }) => {
    if (
      hasLegacyCurriculumSearchParams(location.searchStr) ||
      (search.university !== undefined && search.university !== CURRICULUM_DEFAULT_UNIVERSITY_ID)
    ) {
      throw redirect({
        to: "/curriculum/$courseId",
        params,
        search: toCurriculumUrlSearch({
          ...search,
          university: undefined,
        }) as unknown as typeof search,
        replace: true,
      });
    }
  },
});
