import { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

const DashboardPage = lazy(() => import("./-dashboard-page").then((module) => ({ default: module.DashboardPage })));

export const Route = createFileRoute("/_index")({
  component: AppDashboardRoute,
});

function AppDashboardRoute() {
  return (
    <Suspense fallback={<div className="flex-1 bg-background" />}>
      <DashboardPage />
    </Suspense>
  );
}
