import { createFileRoute } from "@tanstack/react-router";

import { InsetSignupPage } from "@/components/inset-auth";

export const Route = createFileRoute("/auth/signup/")({
  component: SignupPage,
});

export default function SignupPage() {
  return <InsetSignupPage />;
}
