import * as React from "react";
import {
  IconDashboard,
  IconCalendarTime,
  IconInnerShadowTop,
  IconSchool,
  IconUsers,
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
import { useAppAuth } from "@/lib/auth/app-auth-context";

const data = {
  navMain: [
    {
      title: "Inicio",
      url: "/",
      icon: IconDashboard,
    },
    {
      title: "Horarios",
      url: "/schedule",
      icon: IconCalendarTime,
    },
    {
      title: "Plan de estudios",
      url: "/curriculum",
      icon: IconSchool,
    },
    {
      title: "Profesores",
      url: "/professors",
      icon: IconUsers,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { authUser } = useAppAuth();

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
              <Link to="/" preload="intent">
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
