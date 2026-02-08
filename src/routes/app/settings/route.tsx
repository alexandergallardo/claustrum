import { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

const SettingsLayout = lazy(() =>
  import("./-settings-layout").then((module) => ({ default: module.SettingsLayout })),
);

export const Route = createFileRoute("/app/settings")({
  component: SettingsRoute,
});

function SettingsRoute() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-background" />}>
      <SettingsLayout />
    </Suspense>
  );
}
