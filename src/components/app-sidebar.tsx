import {
  IconCalendarTime,
  IconDashboard,
  IconFileDescription,
  IconInnerShadowTop,
  IconSchool,
  IconUsers,
} from "@tabler/icons-react";
import { Link, useLocation } from "@tanstack/react-router";
import { EllipsisVertical, LogIn } from "lucide-react";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserMenuDropdown } from "@/components/user-menu-dropdown";
import { useAppAuth } from "@/lib/auth/app-auth-context";
import { cn } from "@/lib/utils";

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
  navSecondary: [
    {
      title: "Reglamento y políticas",
      url: "/policies",
      icon: IconFileDescription,
    },
  ],
};

export function AppSidebar() {
  const { authUser } = useAppAuth();
  const location = useLocation();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const user = authUser
    ? {
        name: authUser.user_metadata?.full_name ?? authUser.email ?? "Guest",
        email: authUser.email ?? "",
        avatar: authUser.user_metadata?.avatar_url ?? "",
      }
    : null;
  const userInitial = user?.name.charAt(0).toUpperCase() ?? "M";

  const isActive = (url: string) =>
    url === "/" ? location.pathname === url : location.pathname.startsWith(url);

  return (
    <aside
      data-user-menu={isUserMenuOpen ? "open" : "closed"}
      className="peer/sidebar group/sidebar bg-muted text-muted-foreground fixed inset-y-0 left-0 z-50 hidden w-20 flex-col px-4 pt-1 pb-4 transition-[width] duration-200 ease-out hover:w-72 data-[user-menu=open]:w-72 md:flex"
    >
      <Link
        to="/"
        preload="intent"
        aria-label="Claustrum"
        className="text-foreground hover:bg-background/70 flex h-12 items-center gap-3 rounded-full transition-colors"
      >
        <span className="flex size-12 shrink-0 items-center justify-center">
          <span className="bg-background flex size-8 items-center justify-center rounded-full shadow-sm">
            <IconInnerShadowTop className="size-5" />
          </span>
        </span>
        <span className="truncate text-sm font-semibold opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-data-[user-menu=open]/sidebar:opacity-100">
          Claustrum
        </span>
      </Link>

      <nav className="flex flex-1 flex-col justify-center gap-2 py-8">
        {data.navMain.map((item) => {
          const active = isActive(item.url);

          return (
            <Link
              key={item.title}
              to={item.url}
              preload="intent"
              aria-label={item.title}
              className={cn(
                "flex h-12 items-center gap-3 rounded-full text-sm font-medium transition-colors",
                active
                  ? "text-foreground group-hover/sidebar:bg-background group-data-[user-menu=open]/sidebar:bg-background group-hover/sidebar:shadow-sm group-data-[user-menu=open]/sidebar:shadow-sm"
                  : "hover:bg-background/70 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-full transition-colors group-hover/sidebar:bg-transparent group-hover/sidebar:shadow-none group-data-[user-menu=open]/sidebar:bg-transparent group-data-[user-menu=open]/sidebar:shadow-none",
                  active && "bg-background shadow-sm",
                )}
              >
                <item.icon className="size-5" />
              </span>
              <span className="truncate opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-data-[user-menu=open]/sidebar:opacity-100">
                {item.title}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3">
        {data.navSecondary.map((item) => {
          const active = isActive(item.url);

          return (
            <Link
              key={item.title}
              to={item.url}
              preload="intent"
              aria-label={item.title}
              className={cn(
                "flex h-12 items-center gap-3 rounded-full text-sm font-medium transition-colors",
                active
                  ? "text-foreground group-hover/sidebar:bg-background group-data-[user-menu=open]/sidebar:bg-background group-hover/sidebar:shadow-sm group-data-[user-menu=open]/sidebar:shadow-sm"
                  : "hover:bg-background/70 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-full transition-colors group-hover/sidebar:bg-transparent group-hover/sidebar:shadow-none group-data-[user-menu=open]/sidebar:bg-transparent group-data-[user-menu=open]/sidebar:shadow-none",
                  active && "bg-background shadow-sm",
                )}
              >
                <item.icon className="size-5" />
              </span>
              <span className="truncate opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-data-[user-menu=open]/sidebar:opacity-100">
                {item.title}
              </span>
            </Link>
          );
        })}

        {user ? (
          <UserMenuDropdown
            user={user}
            open={isUserMenuOpen}
            onOpenChange={setIsUserMenuOpen}
            trigger={
              <Button
                type="button"
                variant="ghost"
                className="hover:bg-background/80 hover:text-foreground !h-12 w-full justify-start gap-3 rounded-full !p-0 text-left"
              >
                <span className="flex size-12 shrink-0 items-center justify-center">
                  <Avatar className="border-muted-foreground/35 bg-background size-8 rounded-full border">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="bg-muted text-foreground text-xs font-medium">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                </span>
                <span className="grid min-w-0 flex-1 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-data-[user-menu=open]/sidebar:opacity-100">
                  <span className="truncate text-sm font-medium">{user.name}</span>
                  <span className="text-muted-foreground truncate text-xs">{user.email}</span>
                </span>
                <EllipsisVertical className="ml-auto size-4 shrink-0 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-data-[user-menu=open]/sidebar:opacity-100" />
              </Button>
            }
            align="start"
            side="right"
            sideOffset={8}
            contentClass="w-56 rounded-lg"
          />
        ) : (
          <Button
            variant="ghost"
            className="hover:bg-background/80 hover:text-foreground !h-12 w-full justify-start gap-3 rounded-full !p-0 text-left"
            asChild
          >
            <Link to="/auth/signin">
              <span className="flex size-12 shrink-0 items-center justify-center">
                <LogIn className="size-5" />
              </span>
              <span className="truncate opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-data-[user-menu=open]/sidebar:opacity-100">
                Iniciar sesión
              </span>
            </Link>
          </Button>
        )}
      </div>
    </aside>
  );
}
