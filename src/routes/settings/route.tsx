import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

const SettingsLayout = lazy(() =>
  import("./-settings-layout").then((module) => ({ default: module.SettingsLayout })),
);

export const Route = createFileRoute("/settings")({
  component: SettingsRoute,
});

function SettingsRoute() {
  return (
    <Suspense fallback={<div className="bg-background flex-1" />}>
      <SettingsLayout />
    </Suspense>
  );
}
