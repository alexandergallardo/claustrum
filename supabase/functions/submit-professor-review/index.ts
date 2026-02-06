import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const REVIEW_TAGS = [
  "Da buena retroalimentacion",
  "Tomaria su clase nuevamente",
  "Brinda apoyo",
  "Explica con claridad",
  "Examenes retadores",
  "Proyecto util",
] as const;

const payloadSchema = z.object({
  professorId: z.number().int().positive(),
  courseCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(3)
    .max(16)
    .regex(/^[A-Z]{2,4}\d{3,4}$/),
  comment: z.string().trim().min(5).max(1000),
  easeScore: z.number().min(0).max(10),
  qualityScore: z.number().min(0).max(10),
  clarityScore: z.number().min(0).max(10),
  fairnessScore: z.number().min(0).max(10),
  attendanceRequired: z.boolean(),
  gradeReceived: z.string().trim().max(32).optional(),
  engagementLevel: z.number().int().min(1).max(5),
  tags: z.array(z.enum(REVIEW_TAGS)).max(6),
  turnstileToken: z.string().min(1),
});

type TurnstileResponse = {
  success: boolean;
  "error-codes"?: string[];
};

function isRealProfessorName(fullName: string): boolean {
  const normalized = fullName.trim().toLowerCase();
  if (normalized.length === 0) return false;
  if (/sin\s+profesor\s+asignado/i.test(fullName)) return false;
  if (/se\s+imparte\s+en\s+idioma\s+ingles/i.test(fullName)) return false;
  return true;
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Invalid review payload");
    }

    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (!turnstileSecret) {
      return new Response(JSON.stringify({ error: "Missing Turnstile secret configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = req.headers.get("cf-connecting-ip") ?? undefined;
    const turnstileBody = new URLSearchParams({
      secret: turnstileSecret,
      response: parsed.data.turnstileToken,
    });
    if (ip) turnstileBody.set("remoteip", ip);

    const turnstileVerification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: turnstileBody,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!turnstileVerification.ok) {
      return new Response(JSON.stringify({ error: "Could not verify anti-spam token" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const turnstileJson = (await turnstileVerification.json()) as TurnstileResponse;
    if (!turnstileJson.success) {
      return badRequest("Invalid anti-spam token");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase server credentials" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: course, error: courseError } = await admin
      .from("course")
      .select("id,code")
      .eq("code", parsed.data.courseCode)
      .maybeSingle();

    if (courseError) {
      return new Response(JSON.stringify({ error: courseError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!course) {
      return badRequest("Course code does not exist");
    }

    const { data: professorExists, error: professorError } = await admin
      .from("professor")
      .select("id,full_name")
      .eq("id", parsed.data.professorId)
      .maybeSingle();

    if (professorError) {
      return new Response(JSON.stringify({ error: professorError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!professorExists) {
      return badRequest("Professor does not exist");
    }

    if (!isRealProfessorName(professorExists.full_name)) {
      return badRequest("Professor is not eligible for reviews");
    }

    const { data: inserted, error: insertError } = await admin
      .from("professor_review")
      .insert({
        professor_id: parsed.data.professorId,
        course_id: course.id,
        course_code_snapshot: course.code,
        course_name_snapshot: "",
        comment: parsed.data.comment,
        ease_score: parsed.data.easeScore,
        quality_score: parsed.data.qualityScore,
        clarity_score: parsed.data.clarityScore,
        fairness_score: parsed.data.fairnessScore,
        attendance_required: parsed.data.attendanceRequired,
        grade_received: parsed.data.gradeReceived ?? null,
        engagement_level: parsed.data.engagementLevel,
        tags: parsed.data.tags,
        status: "pending",
      })
      .select("id,status,created_at")
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, review: inserted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Unexpected server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
