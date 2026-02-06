import * as React from "react";
import {
  IconDashboard,
  IconBook,
  IconCalendarTime,
  IconInnerShadowTop,
} from "@tabler/icons-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link } from "@tanstack/react-router";
import { useAuthUser } from "@/lib/hooks/use-queries";

const data = {
  navMain: [
    {
      title: "Panel",
      url: "/app",
      icon: IconDashboard,
    },
    {
      title: "Horarios",
      url: "/app/schedule",
      icon: IconCalendarTime,
    },
    {
      title: "Plan de estudios",
      url: "/app/curriculum",
      icon: IconBook,
    },
    {
      title: "Profesores",
      url: "/app/professors",
      icon: IconBook,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: authUser } = useAuthUser();

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
              <Link to="/">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">Claustrum</span>
              </Link>
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
  );
}
