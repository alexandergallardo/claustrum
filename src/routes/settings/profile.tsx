import { Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";

const ProfilePageRoute = lazy(() =>
  import("./-profile-page").then((module) => ({ default: module.ProfilePageRoute })),
);

export const Route = createFileRoute("/settings/profile")({
  component: ProfileRoute,
});

function ProfileRoute() {
  return (
    <Suspense fallback={<div className="min-h-[240px]" />}>
      <ProfilePageRoute />
    </Suspense>
  );
}
