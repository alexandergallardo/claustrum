import { createMiddleware } from "@tanstack/react-start/server";
import type { Context } from "@cloudflare/workers-types";

export const middleware = createMiddleware(async (context) => {
  // Inject Cloudflare environment variables into import.meta.env for the client
  const env = (context as unknown as Record<string, unknown>).env as
    | Record<string, string>
    | undefined;

  if (env) {
    // Make environment variables available to the app
    globalThis.CLOUDFLARE_ENV = {
      VITE_SUPABASE_URL: env.VITE_SUPABASE_URL as string,
      VITE_SUPABASE_PUBLISHABLE_KEY: env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    };
  }
});
