import { createFileRoute, redirect } from "@tanstack/react-router";

import { buildSeoMeta } from "@/lib/seo";

import {
  hasLegacyScheduleSearchParams,
  parseScheduleSearch,
  SCHEDULE_DEFAULT_UNIVERSITY_ID,
  toScheduleUrlSearch,
} from "./-schedule-search";

export const Route = createFileRoute("/schedule/")({
  head: () =>
    buildSeoMeta({
      title: "Generador y Creador de Horarios TEC (ITCR) | Claustrum",
      description:
        "El mejor creador de horarios para el Tecnológico de Costa Rica. Arma tu horario, evalúa profesores y más.",
      breadcrumbName: "Horarios",
      urlPath: "/schedule",
    }),
  validateSearch: parseScheduleSearch,
  search: {
    middlewares: [
      ({ search, next }) => toScheduleUrlSearch(next(search)) as unknown as typeof search,
    ],
  },
  beforeLoad: ({ search, location }) => {
    const hasLegacyParams = hasLegacyScheduleSearchParams(location.searchStr);
    if (
      hasLegacyParams ||
      (search.university !== undefined && search.university !== SCHEDULE_DEFAULT_UNIVERSITY_ID)
    ) {
      throw redirect({
        to: "/schedule",
        search: toScheduleUrlSearch({
          ...search,
          university: undefined,
        }) as unknown as typeof search,
        replace: true,
      });
    }
  },
});
