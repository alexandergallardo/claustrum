import { createFileRoute, redirect } from "@tanstack/react-router";

import {
  universitiesQueryOptions,
  campusesQueryOptions,
  academicUnitsQueryOptions,
  studyPlansQueryOptions,
} from "@/lib/hooks/use-queries";
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
      title: "Explorador de planes de estudio | Claustrum",
      description:
        "Explora los planes de estudio interactivos. Revisa cursos, requisitos y la malla curricular de tu carrera.",
      breadcrumbName: "Planes de Estudio",
      urlPath: "/curriculum",
      image: "/og/og-curriculum.png",
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
  loaderDeps: ({ search }) => ({
    university: search.university,
    campus: search.campus,
    career: search.career,
    plan: search.plan,
  }),
  loader: async ({ context: { queryClient }, deps }) => {
    const promises: Promise<unknown>[] = [];
    promises.push(queryClient.ensureQueryData(universitiesQueryOptions()));

    const u = deps.university ?? CURRICULUM_DEFAULT_UNIVERSITY_ID;
    if (u) promises.push(queryClient.ensureQueryData(campusesQueryOptions(u)));
    if (deps.campus)
      promises.push(queryClient.ensureQueryData(academicUnitsQueryOptions(deps.campus)));
    if (deps.career)
      promises.push(queryClient.ensureQueryData(studyPlansQueryOptions(deps.career)));

    await Promise.allSettled(promises);
  },
});
