import { AppSidebar } from "@/components/app-sidebar"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { SiteHeader } from "@/components/site-header"
import { AppAuthProvider } from "@/lib/auth/app-auth-context"

export function AppLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AppAuthProvider>
      <div
        className="flex h-svh overflow-hidden bg-muted text-foreground"
        style={
          {
            "--header-height": "calc(var(--spacing) * 14)",
          } as React.CSSProperties
        }
      >
        <AppSidebar />
        <main className="flex min-w-0 flex-1 flex-col bg-muted transition-[margin] duration-200 ease-out md:ml-20 md:peer-hover/sidebar:ml-72 md:peer-data-[user-menu=open]/sidebar:ml-72">
          <SiteHeader />
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-background md:rounded-tl-2xl">
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto pb-24 md:pb-0">
              {children}
            </div>
          </div>
        </main>
        <MobileBottomNav />
      </div>
    </AppAuthProvider>
  )
}
