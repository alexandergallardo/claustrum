import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import { SearchIcon } from "lucide-react";
import { useEffect } from "react";

import { AppLayoutWrapper } from "@/components/app-layout-wrapper";
import { ThemeProvider } from "@/components/theme-provider";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Toaster } from "@/components/ui/sonner";
import { useAuthUser, useOnboardingStatus, useProfileContext } from "@/lib/hooks/use-queries";
import { queryClient } from "@/lib/query-client";
import { useRouteSeo } from "@/lib/seo";

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootComponent() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useRouteSeo(pathname);

  const isAuthRoute = pathname === "/auth" || pathname.startsWith("/auth/");
  const isPublicRoute =
    isAuthRoute ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/docs") ||
    pathname === "/";

  const { data: authUser, isLoading: isAuthLoading } = useAuthUser({ enabled: !isPublicRoute });
  const profileContext = useProfileContext(authUser?.id ?? null);
  const onboardingStatus = useOnboardingStatus(authUser?.id ?? null);

  const completed = !!onboardingStatus.data?.onboarding_completed_at;
  const dismissedAtRaw = onboardingStatus.data?.onboarding_dismissed_at;
  const dismissedAt = dismissedAtRaw ? new Date(dismissedAtRaw) : null;
  const oneDayMs = 24 * 60 * 60 * 1000;
  const isDismissedCooldownActive = dismissedAt
    ? Date.now() - dismissedAt.getTime() < oneDayMs
    : false;
  const hasAcademicSetup = !!profileContext.data?.study_plan_id;
  const canEvaluateOnboarding =
    !isAuthLoading &&
    !!authUser &&
    !profileContext.isLoading &&
    !onboardingStatus.isLoading &&
    !profileContext.isError &&
    !onboardingStatus.isError;

  const needsOnboardingRedirect =
    !isPublicRoute &&
    canEvaluateOnboarding &&
    !completed &&
    !isDismissedCooldownActive &&
    !hasAcademicSetup;

  const shouldLeaveOnboarding =
    pathname.startsWith("/onboarding") &&
    canEvaluateOnboarding &&
    (completed || isDismissedCooldownActive || hasAcademicSetup);

  const shouldHoldPrivateRender =
    !isPublicRoute &&
    (isAuthLoading ||
      (!!authUser && (profileContext.isLoading || onboardingStatus.isLoading)) ||
      needsOnboardingRedirect);

  useEffect(() => {
    if (needsOnboardingRedirect) {
      void navigate({ to: "/onboarding", replace: true });
      return;
    }

    if (shouldLeaveOnboarding) {
      void navigate({ to: "/overview", replace: true });
    }
  }, [navigate, needsOnboardingRedirect, shouldLeaveOnboarding]);

  return (
    <html lang="es">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="preconnect" href="https://api.github.com" />
        <link rel="dns-prefetch" href="https://api.github.com" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" sizes="any" />
        <link id="app-favicon" rel="icon" type="image/svg+xml" href="/favicon-light.svg" />
        <link rel="apple-touch-icon" href="/logo192.png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/logo512.png" sizes="512x512" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="application-name" content="Claustrum" />
        <meta name="apple-mobile-web-app-title" content="Claustrum" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0a0a0a" />
        <link rel="canonical" href="https://claustrum.maugp.com/" />
        <meta name="author" content="Mauricio González Prendas" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
          html, body, #root { height: 100%; }
          html { background: oklch(1 0 0); color-scheme: light; }
          @media (prefers-color-scheme: dark) { html { background: oklch(0.145 0 0); color-scheme: dark; } }
          body { margin: 0; background: inherit; }
        `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
          (() => {
            try {
              const storageKey = "theme";
              const storedTheme = localStorage.getItem(storageKey);
              const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
              const resolvedTheme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : prefersDark ? "dark" : "light";
              const html = document.documentElement;
              html.classList.remove("light", "dark");
              html.classList.add(resolvedTheme);
              html.style.colorScheme = resolvedTheme;
              const faviconBase = resolvedTheme === "dark" ? "/favicon-dark.svg" : "/favicon-light.svg";
              const faviconHref = faviconBase + "?theme=" + resolvedTheme;
              const svgIcon = document.getElementById("app-favicon");
              if (svgIcon && svgIcon instanceof HTMLLinkElement) { svgIcon.href = faviconHref; }
              const backgroundColor = resolvedTheme === "dark" ? "oklch(0.145 0 0)" : "oklch(1 0 0)";
              const fallbackThemeColor = resolvedTheme === "dark" ? "#0a0a0a" : "#ffffff";
              html.style.backgroundColor = backgroundColor;
              const themeColorMetas = document.querySelectorAll('meta[name="theme-color"]');
              themeColorMetas.forEach((meta) => meta.setAttribute("content", fallbackThemeColor));
            } catch {}
          })();
        `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: `
          {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                "name": "Claustrum",
                "url": "https://claustrum.maugp.com/",
                "inLanguage": "es-CR",
                "description": "Organiza horarios, cursos, evaluaciones y progreso académico del TEC en una plataforma hecha para estudiantes."
              },
              {
                "@type": "SoftwareApplication",
                "name": "Claustrum",
                "applicationCategory": "EducationalApplication",
                "operatingSystem": "Web",
                "inLanguage": "es-CR",
                "description": "Organiza horarios, cursos, evaluaciones y progreso académico del TEC en una plataforma hecha para estudiantes.",
                "offers": { "@type": "Offer", "price": "0", "priceCurrency": "CRC" },
                "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.8", "ratingCount": "150" }
              }
            ]
          }
        `,
          }}
        />
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <RootProvider
              key={pathname.startsWith("/docs") ? "docs-framework" : "app-framework"}
              theme={{
                enabled: pathname.startsWith("/docs"),
                storageKey: "docs-theme",
                defaultTheme: "system",
                attribute: "class",
              }}
              search={{ enabled: pathname.startsWith("/docs") }}
              i18n={{
                translations: {
                  chooseLanguage: "Elegir idioma",
                  chooseTheme: "Tema",
                  editOnGithub: "Editar en GitHub",
                  lastUpdate: "Última actualización",
                  nextPage: "Página siguiente",
                  previousPage: "Página anterior",
                  search: "Buscar",
                  searchNoResult: "No se encontraron resultados",
                  toc: "En esta página",
                  tocNoHeadings: "Sin encabezados",
                },
              }}
            >
              {isPublicRoute ? (
                <Outlet />
              ) : shouldHoldPrivateRender ? (
                <AppLayoutWrapper>
                  <div className="bg-background flex-1" />
                </AppLayoutWrapper>
              ) : (
                <AppLayoutWrapper>
                  <Outlet />
                </AppLayoutWrapper>
              )}
              <Toaster />
            </RootProvider>
          </ThemeProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <div className="container mx-auto px-4 py-16">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>404 - Página no encontrada</EmptyTitle>
          <EmptyDescription>
            La página que buscas no existe. Intenta buscar lo que necesitas abajo.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <InputGroup className="sm:w-3/4">
            <InputGroupInput placeholder="Buscar páginas..." />
            <InputGroupAddon>
              <SearchIcon className="size-4" />
            </InputGroupAddon>
            <InputGroupAddon align="inline-end">
              <Kbd>/</Kbd>
            </InputGroupAddon>
          </InputGroup>

          <EmptyDescription>
            ¿Necesitas ayuda?{" "}
            <Link to="/auth/signin" className="underline underline-offset-4">
              Contactar soporte
            </Link>
          </EmptyDescription>
        </EmptyContent>
      </Empty>
    </div>
  );
}
