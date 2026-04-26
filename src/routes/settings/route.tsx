import { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

const SettingsLayout = lazy(() =>
  import("./-settings-layout").then((module) => ({ default: module.SettingsLayout })),
);

export const Route = createFileRoute("/settings")({
  component: SettingsRoute,
});

function SettingsRoute() {
  return (
    <Suspense fallback={<div className="flex-1 bg-background" />}>
      <SettingsLayout />
    </Suspense>
  );
}
