import { createFileRoute, Link, Outlet, useLocation, redirect } from "@tanstack/react-router";
import {
  UserIcon,
  ShieldIcon,
  PaletteIcon,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/app/settings/")({
  beforeLoad: () => {
    throw redirect({ to: "/app/settings/profile" });
  },
  component: SettingsIndex,
});

function SettingsIndex() {
  return null;
}
