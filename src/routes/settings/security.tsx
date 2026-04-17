import { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

const SecurityPage = lazy(() =>
  import("./-security-page").then((module) => ({ default: module.SecurityPage })),
);

export const Route = createFileRoute("/settings/security")({
  component: SecurityRoute,
});

function SecurityRoute() {
  return (
    <Suspense fallback={<div className="min-h-[240px]" />}>
      <SecurityPage />
    </Suspense>
  );
}
