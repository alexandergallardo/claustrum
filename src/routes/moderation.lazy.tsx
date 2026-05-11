import { createLazyFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

const AdminModerationPage = lazy(() =>
  import("./-admin-moderation-page").then((module) => ({ default: module.AdminModerationPage })),
);

export const Route = createLazyFileRoute("/moderation")({
  component: ModerationRoute,
});

function ModerationRoute() {
  return (
    <Suspense fallback={<div className="bg-background flex-1" />}>
      <AdminModerationPage />
    </Suspense>
  );
}
