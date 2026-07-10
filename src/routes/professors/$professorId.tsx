import { createFileRoute } from "@tanstack/react-router";

import { getProfessorById } from "@/lib/professor-reviews/api";
import { buildSeoMeta } from "@/lib/seo";

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
  loader: async ({ context: { queryClient }, params: { professorId } }) => {
    if (!/^\d+$/.test(professorId)) return null;
    return queryClient
      .ensureQueryData({
        queryKey: ["professorById", professorId],
        queryFn: () => getProfessorById(professorId),
      })
      .catch(() => null);
  },
  head: (ctx) => {
    const professor = ctx.loaderData;
    const name = professor?.full_name ?? "Profesor";
    return buildSeoMeta({
      title: `Reseñas de ${name} | Claustrum`,
      description: `Explora las reseñas y evaluaciones de ${name} escritas por estudiantes del Tecnológico de Costa Rica.`,
      breadcrumbName: name,
      urlPath: `/professors/${ctx.params.professorId}`,
      image: "/og/og-professors.png",
      ogType: "profile",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Person",
          name: name,
          jobTitle: "Profesor",
          worksFor: {
            "@type": "EducationalOrganization",
            name: "Instituto Tecnológico de Costa Rica",
          },
        },
      ],
    });
  },
});
