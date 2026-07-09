import { createFileRoute, redirect } from "@tanstack/react-router";

import {
  universitiesQueryOptions,
  campusesQueryOptions,
  academicUnitsQueryOptions,
  studyPlansQueryOptions,
  academicTermsQueryOptions,
} from "@/lib/hooks/use-queries";
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
      title: "Generador de horarios para estudiantes | Claustrum",
      description:
        "Arma y organiza tu horario semestral, evalúa cursos y gestiona tu avance académico de forma sencilla.",
      breadcrumbName: "Horarios",
      urlPath: "/schedule",
      image: "/og/og-schedule.png",
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
  loaderDeps: ({ search }) => ({
    university: search.university,
    campus: search.campus,
    career: search.career,
    plan: search.plan,
  }),
  loader: async ({ context: { queryClient }, deps }) => {
    const promises: Promise<unknown>[] = [];
    promises.push(queryClient.ensureQueryData(universitiesQueryOptions()));

    const u = deps.university ?? SCHEDULE_DEFAULT_UNIVERSITY_ID;
    if (u) promises.push(queryClient.ensureQueryData(campusesQueryOptions(u)));
    if (deps.campus)
      promises.push(queryClient.ensureQueryData(academicUnitsQueryOptions(deps.campus)));
    if (deps.career)
      promises.push(queryClient.ensureQueryData(studyPlansQueryOptions(deps.career)));
    if (deps.campus)
      promises.push(
        queryClient.ensureQueryData(academicTermsQueryOptions(deps.campus, deps.plan ?? null)),
      );

    await Promise.allSettled(promises);
  },
});
