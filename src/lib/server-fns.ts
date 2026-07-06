import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import type { UserProfileContextRow } from "@/lib/types";

import { getSupabaseServerClient } from "@/lib/supabase/server-client";

export const getProfileContextServerFn = createServerFn({ method: "GET" })
  .validator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    if (!userId) return null;
    const headers = getRequestHeaders();
    const sb = await getSupabaseServerClient(headers as any);
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
    const headers = getRequestHeaders();
    const sb = await getSupabaseServerClient(headers as any);
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
