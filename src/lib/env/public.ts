import { z } from "zod";

declare global {
  var CLOUDFLARE_ENV: Record<string, string> | undefined;
}

const publicEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

function formatZodError(prefix: string, error: z.ZodError): string {
  const details = error.issues
    .map((i) => {
      const p = i.path.length ? i.path.join(".") : "(root)";
      return `- ${p}: ${i.message}`;
    })
    .join("\n");
  return `${prefix}\n${details}`;
}

let cachedPublicEnv: z.infer<typeof publicEnvSchema> | null = null;

export function getPublicEnv(): z.infer<typeof publicEnvSchema> {
  if (cachedPublicEnv) return cachedPublicEnv;

  if (
    typeof import.meta === "undefined" ||
    typeof import.meta.env === "undefined"
  ) {
    throw new Error("Environment variables not available in this runtime");
  }

  // For Cloudflare Workers, merge Cloudflare env vars with import.meta.env
  const env = {
    ...import.meta.env,
    ...(typeof globalThis !== "undefined" && (globalThis as any).CLOUDFLARE_ENV),
  };

  const parsed = publicEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      formatZodError(
        "Invalid environment variables:\n" +
          "- VITE_SUPABASE_URL\n" +
          "- VITE_SUPABASE_PUBLISHABLE_KEY",
        parsed.error,
      ),
    );
  }

  cachedPublicEnv = parsed.data;
  return parsed.data;
}

export type SupabasePublicEnv = {
  supabaseUrl: string;
  supabasePublishableKey: string;
};

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const { VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY } = getPublicEnv();
  return {
    supabaseUrl: VITE_SUPABASE_URL,
    supabasePublishableKey: VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}
