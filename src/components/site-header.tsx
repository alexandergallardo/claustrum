import { Moon, Sun, Bell, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "@/components/theme-provider"
import { UserMenuDropdown } from "@/components/user-menu-dropdown";
import { useAppAuth } from "@/lib/auth/app-auth-context";
import { Link } from "@tanstack/react-router";

export function SiteHeader() {
  const { theme, setTheme } = useTheme();
  const { authUser: user } = useAppAuth();

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  const userName = user?.user_metadata?.full_name || user?.email || "";
  const userEmail = user?.email || "";

  return (
    <header className="sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center gap-2 border-b rounded-t-lg bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">Claustrum</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" disabled>
            <Bell className="h-[1.2rem] w-[1.2rem]" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          {user ? (
            <UserMenuDropdown
              user={{
                name: userName,
                email: userEmail,
                avatar: user.user_metadata?.avatar_url,
              }}
              trigger={
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.user_metadata?.avatar_url} alt={userName} />
                    <AvatarFallback>{userName.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Button>
              }
              align="end"
              side="bottom"
              sideOffset={4}
            />
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">
                <LogIn className="h-4 w-4 mr-1" />
                Iniciar sesión
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
