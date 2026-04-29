import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AuthShell } from "@/components/auth-shell";

export const Route = createFileRoute("/auth")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/auth" || location.pathname === "/auth/") {
      throw redirect({ to: "/auth/signin", replace: true });
    }
  },
  component: AuthRoute,
});

function AuthRoute() {
  return (
    <AuthShell>
      <Outlet />
    </AuthShell>
  );
}
