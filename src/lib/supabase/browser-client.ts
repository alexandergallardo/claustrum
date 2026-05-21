import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { authClient } from "@/lib/auth/client";
import { getSupabasePublicEnv } from "@/lib/env/public";

let cached: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (cached) return cached;

  const { supabaseUrl, supabasePublishableKey } = getSupabasePublicEnv();

  cached = createClient(supabaseUrl, supabasePublishableKey, {
    accessToken: async () => {
      const { data } = await authClient.token().catch(() => ({ data: null }));
      return data?.token ?? null;
    },
  });

  return cached;
}
