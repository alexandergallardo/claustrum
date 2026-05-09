import { useEffect } from "react";

const DEFAULT_TITLE = "Claustrum | Horarios, cursos y avance academico TEC";
const DEFAULT_DESCRIPTION =
  "Organiza horarios, cursos, evaluaciones y progreso academico del TEC en una plataforma hecha para estudiantes.";
const DEFAULT_IMAGE = "/logo512.png";
const INDEXABLE_ROBOTS = "index, follow, max-snippet:150, max-image-preview:large";
const NOINDEX_ROBOTS = "noindex, follow";

type SeoConfig = {
  title: string;
  description: string;
  robots: string;
  breadcrumbName?: string;
};

function getSeoConfig(pathname: string): SeoConfig {
  if (pathname === "/" || pathname === "") {
    return {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      robots: INDEXABLE_ROBOTS,
    };
  }

  if (pathname.startsWith("/policies")) {
    return {
      title: "Reglamento, politicas de uso y privacidad | Claustrum",
      description:
        "Consulta el reglamento, las politicas de uso, privacidad, moderacion y propiedad intelectual de Claustrum.",
      robots: INDEXABLE_ROBOTS,
      breadcrumbName: "Politicas",
    };
  }

  if (pathname.startsWith("/schedule")) {
    return {
      title: "Creador de horarios TEC | Claustrum",
      description:
        "Crea horarios del TEC por sede, carrera, plan de estudios y periodo. Explora cursos, grupos y combina opciones para organizar tu semestre.",
      robots: INDEXABLE_ROBOTS,
      breadcrumbName: "Creador de horarios TEC",
    };
  }

  if (pathname.startsWith("/curriculum")) {
    return {
      title: "Plan de estudios TEC | Claustrum",
      description:
        "Consulta planes de estudio del TEC con cursos, requisitos, correquisitos, equivalencias y avance academico por carrera.",
      robots: INDEXABLE_ROBOTS,
      breadcrumbName: "Plan de estudios TEC",
    };
  }

  if (pathname.startsWith("/professors")) {
    return {
      title: "Resenas de profes TEC | Claustrum",
      description:
        "Busca resenas de profes del TEC, compara experiencias de cursos y encuentra informacion academica compartida por estudiantes.",
      robots: INDEXABLE_ROBOTS,
      breadcrumbName: "Resenas de profes TEC",
    };
  }

  if (pathname.startsWith("/auth/signup")) {
    return {
      title: "Crear cuenta | Claustrum",
      description:
        "Crea una cuenta en Claustrum para organizar tu plan de estudios, horarios y progreso academico.",
      robots: "noindex, follow",
    };
  }

  if (pathname.startsWith("/auth/signin")) {
    return {
      title: "Iniciar sesion | Claustrum",
      description: "Inicia sesion en Claustrum para continuar con tu organizacion academica.",
      robots: "noindex, follow",
    };
  }

  return {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    robots: NOINDEX_ROBOTS,
  };
}

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let meta = document.head.querySelector<HTMLMetaElement>(selector);

  if (!meta) {
    meta = document.createElement("meta");
    document.head.appendChild(meta);
  }

  for (const [name, value] of Object.entries(attributes)) {
    meta.setAttribute(name, value);
  }
}

function upsertLink(selector: string, attributes: Record<string, string>) {
  let link = document.head.querySelector<HTMLLinkElement>(selector);

  if (!link) {
    link = document.createElement("link");
    document.head.appendChild(link);
  }

  for (const [name, value] of Object.entries(attributes)) {
    link.setAttribute(name, value);
  }
}

function upsertJsonLd(id: string, data: Record<string, unknown>) {
  let script = document.head.querySelector<HTMLScriptElement>(`script#${id}`);

  if (!script) {
    script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(data);
}

function getCanonicalUrl(pathname: string) {
  return `${window.location.origin}${pathname}`;
}

export function useRouteSeo(pathname: string) {
  useEffect(() => {
    const seo = getSeoConfig(pathname);
    const canonicalUrl = getCanonicalUrl(pathname);
    const imageUrl = new URL(DEFAULT_IMAGE, window.location.origin).toString();

    document.title = seo.title;

    upsertMeta('meta[name="description"]', { name: "description", content: seo.description });
    upsertMeta('meta[name="robots"]', { name: "robots", content: seo.robots });
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: seo.title });
    upsertMeta('meta[property="og:description"]', {
      property: "og:description",
      content: seo.description,
    });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
    upsertMeta('meta[property="og:image"]', { property: "og:image", content: imageUrl });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: seo.title });
    upsertMeta('meta[name="twitter:description"]', {
      name: "twitter:description",
      content: seo.description,
    });
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: imageUrl });
    upsertLink('link[rel="canonical"]', { rel: "canonical", href: canonicalUrl });

    upsertJsonLd("route-web-page", {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: seo.title,
      description: seo.description,
      url: canonicalUrl,
      inLanguage: "es-CR",
      isPartOf: {
        "@type": "WebSite",
        name: "Claustrum",
        url: window.location.origin,
      },
    });

    if (seo.breadcrumbName) {
      upsertJsonLd("route-breadcrumbs", {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Claustrum",
            item: window.location.origin,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: seo.breadcrumbName,
            item: canonicalUrl,
          },
        ],
      });
    }
  }, [pathname]);
}
