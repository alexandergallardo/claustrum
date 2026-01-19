import * as React from "react"
import {
  IconDashboard,
  IconBook,
  IconCalendarTime,
  IconInnerShadowTop,
} from "@tabler/icons-react"
import type { User } from "@supabase/supabase-js"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client"

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/app",
      icon: IconDashboard,
    },
    {
      title: "Horarios",
      url: "/app/schedule",
      icon: IconCalendarTime,
    },
    {
      title: "Plan de Estudios",
      url: "/app/curriculum",
      icon: IconBook,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [authUser, setAuthUser] = React.useState<User | null>(null)

  React.useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    async function initAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setAuthUser(user)
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const user = authUser
    ? {
        name: authUser.user_metadata?.full_name ?? authUser.email ?? "Guest",
        email: authUser.email ?? "",
        avatar: "",
      }
    : null;

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">Claustrum</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
