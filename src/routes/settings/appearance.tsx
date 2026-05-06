import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

const AppearancePage = lazy(() =>
  import("./-appearance-page").then((module) => ({ default: module.AppearancePage })),
);

export const Route = createFileRoute("/settings/appearance")({
  component: AppearanceRoute,
});

function AppearanceRoute() {
  return (
    <Suspense fallback={<div className="min-h-[240px]" />}>
      <AppearancePage />
    </Suspense>
  );
}
