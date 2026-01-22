import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseSecretEnv } from "@/lib/env/server";

/**
 * Supabase client using the secret key for privileged operations.
 * Disables auth persistence since this is server-only.
 */
let cached: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (cached) return cached;

  const { supabaseUrl, secretKey } = getSupabaseSecretEnv();

  cached = createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return cached;
}

/**
 * Wraps privileged operations with a server Supabase client.
 */
export async function withSupabaseAdmin<T>(
  fn: (client: SupabaseClient) => Promise<T>,
): Promise<T> {
  const client = getSupabaseServerClient();
  return fn(client);
}
