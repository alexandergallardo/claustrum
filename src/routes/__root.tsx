import { createRootRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import { SearchIcon } from "lucide-react";
import { useEffect } from "react";

import { AppLayoutWrapper } from "@/components/app-layout-wrapper";
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
