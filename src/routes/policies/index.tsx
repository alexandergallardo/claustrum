import { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

const PoliciesPage = lazy(() =>
  import("./-policies-page").then((module) => ({ default: module.PoliciesPage })),
);

export const Route = createFileRoute("/policies/")({
  component: PoliciesRoute,
});

function PoliciesRoute() {
  return (
    <Suspense fallback={<div className="flex-1 bg-background" />}>
      <PoliciesPage />
    </Suspense>
  );
}
