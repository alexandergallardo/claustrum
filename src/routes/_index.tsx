import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

const DashboardPage = lazy(() =>
  import("./-dashboard-page").then((module) => ({ default: module.DashboardPage })),
);

export const Route = createFileRoute("/_index")({
  component: AppDashboardRoute,
});

function AppDashboardRoute() {
  return (
    <Suspense fallback={<div className="bg-background flex-1" />}>
      <DashboardPage />
    </Suspense>
  );
}
