import { createFileRoute } from "@tanstack/react-router";

import { AuthResetPasswordPage } from "@/components/auth-reset-password";

export const Route = createFileRoute("/auth/reset-password/")({
  component: ResetPasswordRoute,
});

export default function ResetPasswordRoute() {
  return <AuthResetPasswordPage />;
}
