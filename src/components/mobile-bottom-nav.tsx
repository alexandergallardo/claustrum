import { IconCalendarTime, IconDashboard, IconSchool, IconUsers } from "@tabler/icons-react";
import { Link, useLocation } from "@tanstack/react-router";
import { LogInIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAppAuth } from "@/lib/auth/app-auth-context";
import { cn } from "@/lib/utils";

const mainNavItems = [
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
    title: "Plan",
    url: "/curriculum",
    icon: IconSchool,
  },
  {
    title: "Profesores",
    url: "/professors",
    icon: IconUsers,
  },
];

export function MobileBottomNav() {
  const location = useLocation();
  const { authUser } = useAppAuth();
  const userName = authUser?.user_metadata?.full_name ?? authUser?.email ?? "Perfil";
  const userInitial = userName.charAt(0).toUpperCase();
  const profileUrl = authUser ? "/settings/profile" : "/auth/signin";

  const isActive = (url: string) =>
    url === "/" ? location.pathname === url : location.pathname.startsWith(url);

  return (
    <nav className="border-border/60 bg-background fixed inset-x-0 bottom-0 z-50 flex h-[72px] items-stretch justify-around border-t pb-[env(safe-area-inset-bottom)] md:hidden">
      {mainNavItems.map((item) => {
        const active = isActive(item.url);

        return (
          <Link
            key={item.url}
            to={item.url}
            preload="intent"
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active ? (
              <span className="bg-foreground absolute top-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full" />
            ) : null}
            <item.icon className="size-5 shrink-0" strokeWidth={active ? 2.4 : 2} />
            <span className="truncate">{item.title}</span>
          </Link>
        );
      })}

      <Link
        to={profileUrl}
        aria-current={isActive("/settings") || isActive("/auth") ? "page" : undefined}
        className={cn(
          "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors",
          isActive("/settings") || isActive("/auth")
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {isActive("/settings") || isActive("/auth") ? (
          <span className="bg-foreground absolute top-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full" />
        ) : null}
        {authUser ? (
          <Avatar className="border-muted-foreground/35 size-5 border">
            <AvatarImage src={authUser.user_metadata?.avatar_url} alt={userName} />
            <AvatarFallback className="text-[9px]">{userInitial}</AvatarFallback>
          </Avatar>
        ) : (
          <LogInIcon className="size-5 shrink-0" strokeWidth={isActive("/auth") ? 2.4 : 2} />
        )}
        <span className="truncate">{authUser ? "Perfil" : "Entrar"}</span>
      </Link>
    </nav>
  );
}
