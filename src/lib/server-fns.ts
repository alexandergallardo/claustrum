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
    const incomingUrl = new URL(req.url);

    const customFetch = env?.API
      ? (input: string | URL | Request, init?: RequestInit) => {
          const fetchReq = new Request(input instanceof Request ? input : input.toString(), init);
          const url = new URL(fetchReq.url);
          url.protocol = incomingUrl.protocol;
          url.hostname = incomingUrl.hostname;
          url.port = incomingUrl.port;
          return env.API.fetch(new Request(url, fetchReq));
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
    const incomingUrl = new URL(req.url);

    const customFetch = env?.API
      ? (input: string | URL | Request, init?: RequestInit) => {
          const fetchReq = new Request(input instanceof Request ? input : input.toString(), init);
          const url = new URL(fetchReq.url);
          url.protocol = incomingUrl.protocol;
          url.hostname = incomingUrl.hostname;
          url.port = incomingUrl.port;
          return env.API.fetch(new Request(url, fetchReq));
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

export const dismissOnboardingServerFn = createServerFn({ method: "POST" })
  .validator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    if (!userId) throw new Error("Missing user id");
    const req = getRequest();
    if (!req) throw new Error("Missing request");
    const incomingUrl = new URL(req.url);

    const customFetch = env?.API
      ? (input: string | URL | Request, init?: RequestInit) => {
          const fetchReq = new Request(input instanceof Request ? input : input.toString(), init);
          const url = new URL(fetchReq.url);
          url.protocol = incomingUrl.protocol;
          url.hostname = incomingUrl.hostname;
          url.port = incomingUrl.port;
          return env.API.fetch(new Request(url, fetchReq));
        }
      : undefined;

    const sb = await getSupabaseServerClient(req.headers, customFetch);
    const { error, count } = await sb
      .from("user")
      .update({ onboarding_dismissed_at: new Date().toISOString() }, { count: "exact" })
      .eq("id", userId);

    if (error) throw error;
    if (count === 0) throw new Error("No rows updated. RLS or missing user profile issue.");

    return true;
  });

export const submitOnboardingServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      userId: string;
      campusId: number;
      academicUnitId: number;
      studyPlanId: number;
      entryYear: number | null;
      carnet: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId, campusId, studyPlanId, entryYear, carnet } = data;
    if (!userId) throw new Error("Missing user id");
    const req = getRequest();
    if (!req) throw new Error("Missing request");
    const incomingUrl = new URL(req.url);

    const customFetch = env?.API
      ? (input: string | URL | Request, init?: RequestInit) => {
          const fetchReq = new Request(input instanceof Request ? input : input.toString(), init);
          const url = new URL(fetchReq.url);
          url.protocol = incomingUrl.protocol;
          url.hostname = incomingUrl.hostname;
          url.port = incomingUrl.port;
          return env.API.fetch(new Request(url, fetchReq));
        }
      : undefined;

    const sb = await getSupabaseServerClient(req.headers, customFetch);

    if (carnet) {
      const { error: userError } = await sb.from("user").update({ carnet }).eq("id", userId);
      if (userError) throw userError;
    }

    const { data: activePlan, error: activePlanError } = await sb
      .from("user_study_plan")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (activePlanError) throw activePlanError;

    if (activePlan) {
      const { error: updateError } = await sb
        .from("user_study_plan")
        .update({
          study_plan_id: studyPlanId,
          campus_id: campusId,
          ...(entryYear ? { entry_year: entryYear } : {}),
        })
        .eq("id", activePlan.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await sb.from("user_study_plan").insert({
        user_id: userId,
        study_plan_id: studyPlanId,
        campus_id: campusId,
        entry_year: entryYear || new Date().getFullYear(),
      });
      if (insertError) throw insertError;
    }

    const { error: completionError, count: completionCount } = await sb
      .from("user")
      .update({ onboarding_completed_at: new Date().toISOString() }, { count: "exact" })
      .eq("id", userId);

    if (completionError) throw completionError;
    if (completionCount === 0)
      throw new Error("No rows updated. RLS or missing user profile issue.");

    return true;
  });
