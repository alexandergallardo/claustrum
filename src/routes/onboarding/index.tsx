import { createFileRoute } from "@tanstack/react-router";

import { InsetOnboardingPage } from "@/components/inset-onboarding";

export const Route = createFileRoute("/onboarding/")({
  component: OnboardingPage,
});

export default function OnboardingPage() {
  return <InsetOnboardingPage />;
}
