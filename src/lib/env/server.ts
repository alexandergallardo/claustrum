import { getSupabasePublicEnv } from "@/lib/env/public";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export type SupabaseSecretEnv = {
  supabaseUrl: string;
  secretKey: string;
};

let cachedSecretEnv: SupabaseSecretEnv | null = null;

export function getSupabaseSecretEnv(): SupabaseSecretEnv {
  if (cachedSecretEnv) return cachedSecretEnv;

  if (isBrowser()) {
    throw new Error("Secret configuration cannot be accessed from browser context");
  }

  const { supabaseUrl } = getSupabasePublicEnv();

  const secretKeyRaw = process.env.SUPABASE_SECRET_KEY;
  const secretKey = secretKeyRaw?.trim();

  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY is required for server operations");
  }

  cachedSecretEnv = { supabaseUrl, secretKey };
  return cachedSecretEnv;
}
