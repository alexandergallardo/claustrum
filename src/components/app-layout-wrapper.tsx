import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { AppAuthProvider } from "@/lib/auth/app-auth-context"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export function AppLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AppAuthProvider>
      <SidebarProvider
        className="h-svh overflow-hidden"
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AppAuthProvider>
  )
}
