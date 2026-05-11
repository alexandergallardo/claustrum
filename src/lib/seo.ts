import { useEffect } from "react";

const DEFAULT_TITLE = "Claustrum | Horarios, cursos y avance académico TEC";
const DEFAULT_DESCRIPTION =
  "Organiza horarios, cursos, evaluaciones y progreso académico del TEC en una plataforma hecha para estudiantes.";
const DEFAULT_IMAGE = "/logo512.png";
const INDEXABLE_ROBOTS = "index, follow, max-snippet:150, max-image-preview:large";
const NOINDEX_ROBOTS = "noindex, follow";

const BASE_URL = "https://claustrum.maugp.com";

type SeoConfig = {
  title: string;
  description: string;
  robots: string;
  ogType?: string;
  breadcrumbName?: string;
};

function getSeoConfig(pathname: string): SeoConfig {
  if (pathname === "/" || pathname === "") {
    return {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      robots: INDEXABLE_ROBOTS,
      ogType: "website",
    };
  }

  if (pathname.startsWith("/policies")) {
    return {
      title: "Reglamento, políticas de uso y privacidad | Claustrum",
      description:
        "Consulta el reglamento, las políticas de uso, privacidad, moderación y propiedad intelectual de Claustrum.",
      robots: INDEXABLE_ROBOTS,
      ogType: "article",
      breadcrumbName: "Políticas",
    };
  }

  if (pathname.startsWith("/schedule")) {
    return {
      title: "Creador de horarios TEC | Claustrum",
      description:
        "Crea horarios del TEC por sede, carrera, plan de estudios y periodo. Explora cursos, grupos y combina opciones para organizar tu semestre.",
      robots: INDEXABLE_ROBOTS,
      ogType: "website",
      breadcrumbName: "Creador de horarios TEC",
    };
  }

  if (pathname.startsWith("/curriculum")) {
    return {
      title: "Plan de estudios TEC | Claustrum",
      description:
        "Consulta planes de estudio del TEC con cursos, requisitos, correquisitos, equivalencias y avance académico por carrera.",
      robots: INDEXABLE_ROBOTS,
      ogType: "website",
      breadcrumbName: "Plan de estudios TEC",
    };
  }

  if (pathname.startsWith("/professors")) {
    return {
      title: "Reseñas de profes TEC | Claustrum",
      description:
        "Busca reseñas de profes del TEC, compara experiencias de cursos y encuentra información académica compartida por estudiantes.",
      robots: INDEXABLE_ROBOTS,
      ogType: "website",
      breadcrumbName: "Reseñas de profes TEC",
    };
  }

  // Auth routes — all noindex
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/moderation") ||
    pathname.startsWith("/overview")
  ) {
    if (pathname.startsWith("/auth/signup")) {
      return {
        title: "Crear cuenta | Claustrum",
        description:
          "Crea una cuenta en Claustrum para organizar tu plan de estudios, horarios y progreso académico.",
        robots: NOINDEX_ROBOTS,
      };
    }

    if (pathname.startsWith("/auth/signin")) {
      return {
        title: "Iniciar sesión | Claustrum",
        description: "Inicia sesión en Claustrum para continuar con tu organización académica.",
        robots: NOINDEX_ROBOTS,
      };
    }

    if (pathname.startsWith("/auth/2fa")) {
      return {
        title: "Autenticación de dos factores | Claustrum",
        description: "Verifica tu identidad con autenticación de dos factores en Claustrum.",
        robots: NOINDEX_ROBOTS,
      };
    }

    if (pathname.startsWith("/auth/verify-email")) {
      return {
        title: "Verificar correo | Claustrum",
        description:
          "Verifica tu dirección de correo electrónico para activar tu cuenta de Claustrum.",
        robots: NOINDEX_ROBOTS,
      };
    }

    if (pathname.startsWith("/auth/reset-password")) {
      return {
        title: "Restablecer contraseña | Claustrum",
        description: "Restablece tu contraseña de Claustrum de forma segura.",
        robots: NOINDEX_ROBOTS,
      };
    }

    if (pathname.startsWith("/auth/magic-link")) {
      return {
        title: "Inicio de sesión mágico | Claustrum",
        description: "Inicia sesión en Claustrum con un enlace mágico enviado a tu correo.",
        robots: NOINDEX_ROBOTS,
      };
    }

    if (pathname.startsWith("/onboarding")) {
      return {
        title: "Configuración inicial | Claustrum",
        description: "Completa la configuración inicial de tu perfil académico en Claustrum.",
        robots: NOINDEX_ROBOTS,
      };
    }

    if (pathname.startsWith("/settings")) {
      return {
        title: "Configuración | Claustrum",
        description: "Administra tu perfil, seguridad y preferencias de Claustrum.",
        robots: NOINDEX_ROBOTS,
      };
    }

    if (pathname.startsWith("/moderation")) {
      return {
        title: "Moderación | Claustrum",
        description: "Panel de moderación de contenido de Claustrum.",
        robots: NOINDEX_ROBOTS,
      };
    }

    if (pathname.startsWith("/overview")) {
      return {
        title: "Inicio | Claustrum",
        description: "Panel de inicio con tu progreso académico, próximos cursos y estadísticas.",
        robots: NOINDEX_ROBOTS,
      };
    }

    // Fallback for any other auth-like route
    return {
      title: "Claustrum",
      description: DEFAULT_DESCRIPTION,
      robots: NOINDEX_ROBOTS,
    };
  }

  // Default for any unknown route: noindex to avoid indexing garbage URLs
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

function removeJsonLd(id: string) {
  const script = document.head.querySelector<HTMLScriptElement>(`script#${id}`);
  if (script) {
    script.remove();
  }
}

function getCanonicalUrl(pathname: string) {
  return `${BASE_URL}${pathname}`;
}

export function useRouteSeo(pathname: string) {
  useEffect(() => {
    const seo = getSeoConfig(pathname);
    const canonicalUrl = getCanonicalUrl(pathname);
    const imageUrl = new URL(DEFAULT_IMAGE, BASE_URL).toString();

    document.title = seo.title;

    // Core meta
    upsertMeta('meta[name="description"]', { name: "description", content: seo.description });
    upsertMeta('meta[name="robots"]', { name: "robots", content: seo.robots });

    // Open Graph
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: seo.title });
    upsertMeta('meta[property="og:description"]', {
      property: "og:description",
      content: seo.description,
    });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
    upsertMeta('meta[property="og:image"]', { property: "og:image", content: imageUrl });
    upsertMeta('meta[property="og:image:type"]', {
      property: "og:image:type",
      content: "image/png",
    });
    upsertMeta('meta[property="og:image:width"]', { property: "og:image:width", content: "512" });
    upsertMeta('meta[property="og:image:height"]', { property: "og:image:height", content: "512" });
    upsertMeta('meta[property="og:image:alt"]', {
      property: "og:image:alt",
      content: "Logo de Claustrum",
    });
    upsertMeta('meta[property="og:type"]', {
      property: "og:type",
      content: seo.ogType ?? "website",
    });

    // Twitter
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: seo.title });
    upsertMeta('meta[name="twitter:description"]', {
      name: "twitter:description",
      content: seo.description,
    });
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: imageUrl });
    upsertMeta('meta[name="twitter:image:alt"]', {
      name: "twitter:image:alt",
      content: "Logo de Claustrum",
    });

    // Canonical
    upsertLink('link[rel="canonical"]', { rel: "canonical", href: canonicalUrl });

    // JSON-LD: WebPage (always)
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
        url: BASE_URL,
      },
    });

    // JSON-LD: Breadcrumbs (only for indexable routes with breadcrumbName)
    if (seo.breadcrumbName && seo.robots === INDEXABLE_ROBOTS) {
      upsertJsonLd("route-breadcrumbs", {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Claustrum",
            item: BASE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: seo.breadcrumbName,
            item: canonicalUrl,
          },
        ],
      });
    } else {
      removeJsonLd("route-breadcrumbs");
    }
  }, [pathname]);
}
