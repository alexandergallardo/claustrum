import type { ReactNode } from "react";

import { AuthLeftPanel, AuthPageBackdrop } from "@/components/inset-auth";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-screen overflow-hidden bg-background text-foreground">
      <AuthPageBackdrop />
      <div className="relative grid h-screen w-full grid-cols-1 lg:grid-cols-[1fr_minmax(440px,560px)]">
        <AuthLeftPanel />
        <div className="relative flex h-full flex-col overflow-y-auto bg-card text-foreground">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-8 lg:py-10">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
