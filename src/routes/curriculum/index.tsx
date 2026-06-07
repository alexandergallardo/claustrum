import { createFileRoute, redirect } from "@tanstack/react-router";

import {
  CURRICULUM_DEFAULT_UNIVERSITY_ID,
  hasLegacyCurriculumSearchParams,
  parseCurriculumSearch,
  toCurriculumUrlSearch,
} from "./-curriculum-search";

export const Route = createFileRoute("/curriculum/")({
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
