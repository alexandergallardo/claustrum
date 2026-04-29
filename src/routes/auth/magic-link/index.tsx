import { createFileRoute } from "@tanstack/react-router";

import { AuthMagicLinkSentPage } from "@/components/auth-magic-link-sent";

export const Route = createFileRoute("/auth/magic-link/")({
  component: MagicLinkSentRoute,
});

export default function MagicLinkSentRoute() {
  return <AuthMagicLinkSentPage />;
}
