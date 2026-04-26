import { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

const ModerationPage = lazy(() =>
  import("./-moderation-page").then((module) => ({ default: module.ModerationPage })),
);

export const Route = createFileRoute("/professors/moderation")({
  component: ModerationRoute,
});

function ModerationRoute() {
  return (
    <Suspense fallback={<div className="flex-1 bg-background" />}>
      <ModerationPage />
    </Suspense>
  );
}
