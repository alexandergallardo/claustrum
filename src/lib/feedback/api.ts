import { getApiBaseUrl } from "@/lib/env/public";

export interface SubmitFeedbackPayload {
  type: "bug" | "feature" | "other";
  content: string;
  turnstileToken: string;
}

export async function submitFeedback(payload: SubmitFeedbackPayload): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    throw new Error("API Worker URL no configurado");
  }

  const response = await fetch(`${apiBaseUrl}/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Error desconocido" }));
    throw new Error(body.error ?? `Error ${response.status}`);
  }
}

export interface FeedbackRow {
  id: number;
  type: "bug" | "feature" | "other";
  content: string;
  is_reviewed: boolean;
  created_at: string;
}

export async function getFeedbackList(limit: number, offset: number): Promise<FeedbackRow[]> {
  const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
  const supabase = getSupabaseBrowserClient();

  const { data, error } = await supabase
    .from("user_feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return data as FeedbackRow[];
}

export async function getUnreviewedFeedbackCount(): Promise<{ total_count: number }[]> {
  const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
  const supabase = getSupabaseBrowserClient();

  const { count, error } = await supabase
    .from("user_feedback")
    .select("*", { count: "exact", head: true })
    .eq("is_reviewed", false);

  if (error) throw error;

  return [{ total_count: count ?? 0 }];
}

export async function markFeedbackAsReviewed(id: number): Promise<void> {
  const { getSupabaseBrowserClient } = await import("@/lib/supabase/browser-client");
  const supabase = getSupabaseBrowserClient();

  const { error } = await supabase.from("user_feedback").update({ is_reviewed: true }).eq("id", id);

  if (error) throw error;
}
