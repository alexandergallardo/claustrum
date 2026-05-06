import { createFileRoute } from "@tanstack/react-router";

import { InsetSigninPage } from "@/components/inset-auth";

export const Route = createFileRoute("/auth/signin/")({
  component: SigninPage,
});

export default function SigninPage() {
  return <InsetSigninPage />;
}
