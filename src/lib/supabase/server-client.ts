import { createClient } from "@supabase/supabase-js";

import { authClient } from "@/lib/auth/client";
import { getSupabasePublicEnv } from "@/lib/env/public";

export async function getSupabaseServerClient(headers: Headers) {
  const { supabaseUrl, supabasePublishableKey } = getSupabasePublicEnv();

  const { data } = await authClient
    .token({
      fetchOptions: {
        headers: headers as any,
      },
    })
    .catch(() => ({ data: null }));

  const token = data?.token ?? null;

  return createClient(supabaseUrl, supabasePublishableKey, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
    auth: {
      persistSession: false,
    },
  });
}
