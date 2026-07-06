import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getEvent } from "vinxi/http";

import type { UserProfileContextRow } from "@/lib/types";

import { getSupabaseServerClient } from "@/lib/supabase/server-client";

export const getProfileContextServerFn = createServerFn({ method: "GET" })
  .validator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    if (!userId) return null;
    const req = getRequest();
    if (!req) return null;

    const event = getEvent();
    const env = event.context.cloudflare?.env;
    const customFetch = env?.API
      ? (url: string | URL | Request, init?: RequestInit) => env.API.fetch(new Request(url, init))
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

    const event = getEvent();
    const env = event.context.cloudflare?.env;
    const customFetch = env?.API
      ? (url: string | URL | Request, init?: RequestInit) => env.API.fetch(new Request(url, init))
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
