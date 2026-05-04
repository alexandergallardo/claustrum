import { createFileRoute } from "@tanstack/react-router";

import { AuthTwoFactorPage } from "@/components/auth-two-factor";

export const Route = createFileRoute("/auth/2fa/")({
  component: TwoFactorRoute,
});

export default function TwoFactorRoute() {
  return <AuthTwoFactorPage />;
}
