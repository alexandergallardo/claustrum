import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
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
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  )
}

function NotFound() {
  return (
    <div className="container mx-auto px-4 py-16">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>404 - Not Found</EmptyTitle>
          <EmptyDescription>
            The page you&apos;re looking for doesn&apos;t exist. Try searching
            for what you need below.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <InputGroup className="sm:w-3/4">
            <InputGroupInput placeholder="Try searching for pages..." />
            <InputGroupAddon>
              <SearchIcon className="size-4" />
            </InputGroupAddon>
            <InputGroupAddon align="inline-end">
              <Kbd>/</Kbd>
            </InputGroupAddon>
          </InputGroup>

          <EmptyDescription>
            Need help?{' '}
            <Link to="/login" className="underline underline-offset-4">
              Contact support
            </Link>
          </EmptyDescription>
        </EmptyContent>
      </Empty>
    </div>
  )
}
