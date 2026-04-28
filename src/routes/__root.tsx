import { createRootRoute, Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { SearchIcon } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { AppLayoutWrapper } from '@/components/app-layout-wrapper'
import { useAuthUser, useOnboardingStatus, useProfileContext } from '@/lib/hooks/use-queries'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Kbd } from '@/components/ui/kbd'

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFound,
})

function RootComponent() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { data: authUser, isLoading: isAuthLoading } = useAuthUser()
  const profileContext = useProfileContext(authUser?.id ?? null)
  const onboardingStatus = useOnboardingStatus(authUser?.id ?? null)

  const isPublicRoute = pathname.startsWith('/auth/') || pathname.startsWith('/onboarding')

  useEffect(() => {
    if (isAuthLoading) return
    if (!authUser) return
    if (pathname.startsWith('/auth/') || pathname.startsWith('/onboarding')) return
    if (profileContext.isLoading) return
    if (onboardingStatus.isLoading) return

    const completed = !!onboardingStatus.data?.onboarding_completed_at
    if (completed) return

    const dismissedAtRaw = onboardingStatus.data?.onboarding_dismissed_at
    const dismissedAt = dismissedAtRaw ? new Date(dismissedAtRaw) : null
    const now = new Date()
    const oneDayMs = 24 * 60 * 60 * 1000
    const isDismissedCooldownActive = dismissedAt ? (now.getTime() - dismissedAt.getTime()) < oneDayMs : false
    if (isDismissedCooldownActive) return

    const hasAcademicSetup = !!profileContext.data?.study_plan_id
    if (!hasAcademicSetup) {
      navigate({ to: '/onboarding' })
    }
  }, [
    authUser,
    isAuthLoading,
    navigate,
    onboardingStatus.data?.onboarding_completed_at,
    onboardingStatus.data?.onboarding_dismissed_at,
    onboardingStatus.isLoading,
    pathname,
    profileContext.data?.study_plan_id,
    profileContext.isLoading,
  ])

  return (
    <>
      {isPublicRoute ? <Outlet /> : <AppLayoutWrapper><Outlet /></AppLayoutWrapper>}
      <Toaster />
    </>
  )
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
            ¿Necesitas ayuda?{' '}
            <Link to="/auth/signin" className="underline underline-offset-4">
              Contactar soporte
            </Link>
          </EmptyDescription>
        </EmptyContent>
      </Empty>
    </div>
  )
}
