import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Separator } from "@/components/ui/separator";

import { FeaturesSection } from "./-features";
import { HomeFooter } from "./-footer";
import { FooterCTA } from "./-footer-cta";
import { HeroSection } from "./-hero";
import { HomeNav } from "./-nav";
import { OpenSourceSection } from "./-open-source";
import { OverviewSection } from "./-overview";
import { StackSection } from "./-stack";

export const Route = createFileRoute("/home/")({ component: HomePage });

function HomePage() {
  const [starCount, setStarCount] = useState<number | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("app-scrollbar");
    return () => {
      document.documentElement.classList.remove("app-scrollbar");
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void fetch("https://api.github.com/repos/mau671/claustrum")
      .then((r) => r.json() as Promise<{ stargazers_count?: number }>)
      .then((data) => {
        if (mounted && typeof data.stargazers_count === "number") {
          setStarCount(data.stargazers_count);
        }
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="bg-background font-body text-foreground relative min-h-screen before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] before:bg-[size:40px_40px] before:opacity-40">
      <div className="relative z-10">
        <HomeNav starCount={starCount} />

        <HeroSection starCount={starCount} />

        <div className="mx-auto max-w-[1100px]">
          <Separator />
        </div>

        <OverviewSection />

        <div className="mx-auto max-w-[1100px]">
          <Separator />
        </div>

        <FeaturesSection />

        <StackSection />

        <OpenSourceSection />

        <div className="mx-auto max-w-[1100px]">
          <Separator />
        </div>

        <FooterCTA />

        <HomeFooter />
      </div>
    </div>
  );
}
