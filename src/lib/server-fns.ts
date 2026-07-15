import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
// @ts-ignore
import { env } from "cloudflare:workers";

import type { UserProfileContextRow } from "@/lib/types";

import { getSupabaseServerClient } from "@/lib/supabase/server-client";

export const getProfileContextServerFn = createServerFn({ method: "GET" })
  .validator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    if (!userId) return null;
    const req = getRequest();
    if (!req) return null;

    const customFetch = env?.API
      ? (input: string | URL | Request, init?: RequestInit) => {
          const req = new Request(input instanceof Request ? input : input.toString(), init);
          return env.API.fetch(req);
        }
      : undefined;

    const sb = await getSupabaseServerClient(req.headers, customFetch);
    const { data, error } = await sb
      .rpc("get_user_profile_with_context", { p_user_id: userId })
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return (data as UserProfileContextRow) || null;
  });

export const getOnboardingStatusServerFn = createServerFn({ method: "GET" })
  .validator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    if (!userId) return null;
    const req = getRequest();
    if (!req) return null;

    const customFetch = env?.API
      ? (input: string | URL | Request, init?: RequestInit) => {
          const req = new Request(input instanceof Request ? input : input.toString(), init);
          return env.API.fetch(req);
        }
      : undefined;

    const sb = await getSupabaseServerClient(req.headers, customFetch);
    const { data, error } = await sb
      .from("user")
      .select("onboarding_dismissed_at,onboarding_completed_at")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return (
      (data as {
        onboarding_dismissed_at: string | null;
        onboarding_completed_at: string | null;
      }) || null
    );
  });

export const getDeviceHintServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const req = getRequest();
  if (!req) return { isMobile: false }; // fallback

  const ua = req.headers.get("user-agent") || "";
  const chMobile = req.headers.get("sec-ch-ua-mobile");

  let isMobile = false;

  if (chMobile) {
    isMobile = chMobile === "?1";
  } else {
    isMobile = /Mobi|Android|iPhone/i.test(ua);
  }

  return { isMobile };
});
