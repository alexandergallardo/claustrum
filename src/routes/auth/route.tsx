import { createFileRoute, Navigate, Outlet, useRouterState } from "@tanstack/react-router";

import { AuthShell } from "@/components/auth-shell";

export const Route = createFileRoute("/auth")({
  component: AuthRoute,
});

function AuthRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname === "/auth" || pathname === "/auth/") {
    return <Navigate to="/auth/signin" replace />;
  }

  return (
    <AuthShell>
      <Outlet />
    </AuthShell>
  );
}
