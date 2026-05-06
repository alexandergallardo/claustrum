import type { User } from "@supabase/supabase-js";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useAuthUser } from "@/lib/hooks/use-queries";

type AppAuthContextValue = {
  authUser: User | null;
  isAuthLoading: boolean;
};

const AppAuthContext = createContext<AppAuthContextValue | null>(null);

export function AppAuthProvider({ children }: { children: ReactNode }) {
  const { data: authUser, isLoading: isAuthLoading } = useAuthUser();

  const value = useMemo(
    () => ({ authUser: authUser ?? null, isAuthLoading }),
    [authUser, isAuthLoading],
  );

  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>;
}

export function useAppAuth() {
  const context = useContext(AppAuthContext);
  if (!context) {
    throw new Error("useAppAuth must be used within AppAuthProvider");
  }
  return context;
}
