import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

const ModerationPage = lazy(() =>
  import("./-moderation-page").then((module) => ({ default: module.ModerationPage })),
);

export const Route = createFileRoute("/professors/moderation")({
  component: ModerationRoute,
});

function ModerationRoute() {
  return (
    <Suspense fallback={<div className="bg-background flex-1" />}>
      <ModerationPage />
    </Suspense>
  );
}
