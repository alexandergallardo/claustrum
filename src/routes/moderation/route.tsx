import { createFileRoute } from "@tanstack/react-router";
import { ModerationLayout } from "./-moderation-layout";
import { buildSeoMeta, NOINDEX_ROBOTS } from "@/lib/seo";

export const Route = createFileRoute("/moderation")({
  head: () =>
    buildSeoMeta({
      title: "Moderación | Claustrum",
      robots: NOINDEX_ROBOTS,
    }),
  component: ModerationLayout,
});
