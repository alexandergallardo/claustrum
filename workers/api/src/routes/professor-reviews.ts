import { Hono } from "hono";
import { z } from "zod";

import type { Env } from "../types";

import { fail, ok } from "../lib/http";
import { verifyAuth, verifyTurnstileToken } from "../lib/security";
import { getSupabase } from "../lib/supabase";

const REVIEW_TAGS = [
  "Da buena retroalimentación",
  "Tomaría su clase nuevamente",
  "Brinda apoyo",
  "Explica con claridad",
  "Exámenes retadores",
  "Proyecto útil",
] as const;

const professorReviewSchema = z.object({
  professorId: z.string().regex(/^\d+$/),
  courseCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(3)
    .max(16)
    .regex(/^[A-Z]{2,4}\d{3,4}$/),
  academicTermId: z.number().int().positive().nullable().optional(),
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

const professorReviewReactionSchema = z.object({
  reaction: z.enum(["like", "dislike"]).nullable(),
});

const PROFESSOR_REVIEW_REPORT_REASONS = [
  "spam",
  "ofensivo",
  "acoso",
  "datos_personales",
  "falso_enganoso",
  "otro",
] as const;

const professorReviewReportSchema = z
  .object({
    reason: z.enum(PROFESSOR_REVIEW_REPORT_REASONS),
    description: z.string().trim().max(1000).optional(),
    turnstileToken: z.string().min(1),
  })
  .superRefine((value, context) => {
    if (value.reason === "otro" && (!value.description || value.description.trim().length === 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Description is required when reason is 'otro'",
        path: ["description"],
      });
    }
  });

function isRealProfessorName(fullName: string): boolean {
  const normalized = fullName.trim().toLowerCase();
  if (normalized.length === 0) return false;
  if (/sin\s+profesor\s+asignado/i.test(fullName)) return false;
  if (/se\s+imparte\s+en\s+idioma\s+ingles/i.test(fullName)) return false;
  return true;
}

const professorReviewsRoutes = new Hono<{ Bindings: Env }>();

professorReviewsRoutes.post("/", async (c) => {
  const request = c.req.raw;
  const body = await request.json();
  const parsed = professorReviewSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, "Invalid review payload", request, c.env);
  }

  if (!c.env.TURNSTILE_SECRET_KEY) {
    return fail(500, "Missing Turnstile secret configuration", request, c.env);
  }

  const isHuman = await verifyTurnstileToken(
    parsed.data.turnstileToken,
    c.env,
    request.headers.get("cf-connecting-ip"),
  );
  if (!isHuman) {
    return fail(400, "Invalid anti-spam token", request, c.env);
  }

  const supabase = getSupabase(c.env);

  const { data: course, error: courseError } = await supabase
    .from("course")
    .select("id,code")
    .eq("code", parsed.data.courseCode)
    .maybeSingle();

  if (courseError) {
    return fail(400, courseError.message, request, c.env);
  }

  if (!course) {
    return fail(400, "Course code does not exist", request, c.env);
  }

  const { data: professorExists, error: professorError } = await supabase
    .from("professor")
    .select("id,full_name")
    .eq("id", parsed.data.professorId)
    .maybeSingle();

  if (professorError) {
    return fail(400, professorError.message, request, c.env);
  }

  if (!professorExists) {
    return fail(400, "Professor does not exist", request, c.env);
  }

  if (!isRealProfessorName(professorExists.full_name)) {
    return fail(400, "Professor is not eligible for reviews", request, c.env);
  }

  if (parsed.data.academicTermId !== null && parsed.data.academicTermId !== undefined) {
    const { data: termMatch, error: termMatchError } = await supabase
      .from("course_offering_group_professor")
      .select("professor_id, course_offering_group!inner(course_offering!inner(academic_term_id))")
      .eq("professor_id", parsed.data.professorId)
      .eq("course_offering_group.course_offering.academic_term_id", parsed.data.academicTermId)
      .limit(1)
      .maybeSingle();

    if (termMatchError) {
      return fail(400, termMatchError.message, request, c.env);
    }

    if (!termMatch) {
      return fail(400, "Professor has no offering records for that academic term", request, c.env);
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("professor_review")
    .insert({
      professor_id: parsed.data.professorId,
      course_id: course.id,
      academic_term_id: parsed.data.academicTermId ?? null,
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
    return fail(400, insertError.message, request, c.env);
  }

  return ok({ success: true, review: inserted }, request, c.env);
});

professorReviewsRoutes.post("/:reviewId/reaction", async (c) => {
  const request = c.req.raw;
  const userId = await verifyAuth(request, c.env);
  if (!userId) {
    return fail(401, "Debes iniciar sesión para reaccionar a una reseña", request, c.env);
  }

  const reviewId = c.req.param("reviewId");
  if (!/^\d+$/.test(reviewId)) {
    return fail(400, "Invalid review id", request, c.env);
  }

  const body = await request.json();
  const parsed = professorReviewReactionSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, "Invalid reaction payload", request, c.env);
  }

  const supabase = getSupabase(c.env);

  const { data: review, error: reviewError } = await supabase
    .from("professor_review")
    .select("id,status")
    .eq("id", reviewId)
    .eq("status", "approved")
    .maybeSingle();

  if (reviewError) {
    return fail(400, reviewError.message, request, c.env);
  }

  if (!review) {
    return fail(404, "Review not found", request, c.env);
  }

  if (parsed.data.reaction === null) {
    const { error: deleteError } = await supabase
      .from("professor_review_reaction")
      .delete()
      .eq("review_id", reviewId)
      .eq("user_id", userId);

    if (deleteError) {
      return fail(400, deleteError.message, request, c.env);
    }
  } else {
    const { error: upsertError } = await supabase.from("professor_review_reaction").upsert(
      {
        review_id: reviewId,
        user_id: userId,
        reaction: parsed.data.reaction,
      },
      { onConflict: "review_id,user_id" },
    );

    if (upsertError) {
      return fail(400, upsertError.message, request, c.env);
    }
  }

  const [{ count: likeCount, error: likeError }, { count: dislikeCount, error: dislikeError }] =
    await Promise.all([
      supabase
        .from("professor_review_reaction")
        .select("id", { count: "exact", head: true })
        .eq("review_id", reviewId)
        .eq("reaction", "like"),
      supabase
        .from("professor_review_reaction")
        .select("id", { count: "exact", head: true })
        .eq("review_id", reviewId)
        .eq("reaction", "dislike"),
    ]);

  if (likeError) {
    return fail(400, likeError.message, request, c.env);
  }

  if (dislikeError) {
    return fail(400, dislikeError.message, request, c.env);
  }

  return ok(
    {
      success: true,
      reaction: parsed.data.reaction,
      likeCount: likeCount ?? 0,
      dislikeCount: dislikeCount ?? 0,
    },
    request,
    c.env,
  );
});

professorReviewsRoutes.post("/:reviewId/report", async (c) => {
  const request = c.req.raw;
  const reviewId = c.req.param("reviewId");
  if (!/^\d+$/.test(reviewId)) {
    return fail(400, "Invalid review id", request, c.env);
  }

  const body = await request.json();
  const parsed = professorReviewReportSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, "Invalid report payload", request, c.env);
  }

  if (!c.env.TURNSTILE_SECRET_KEY) {
    return fail(500, "Missing Turnstile secret configuration", request, c.env);
  }

  const isHuman = await verifyTurnstileToken(
    parsed.data.turnstileToken,
    c.env,
    request.headers.get("cf-connecting-ip"),
  );
  if (!isHuman) {
    return fail(400, "Invalid anti-spam token", request, c.env);
  }

  const supabase = getSupabase(c.env);

  const { data: review, error: reviewError } = await supabase
    .from("professor_review")
    .select("id,status")
    .eq("id", reviewId)
    .eq("status", "approved")
    .maybeSingle();

  if (reviewError) {
    return fail(400, reviewError.message, request, c.env);
  }

  if (!review) {
    return fail(404, "Review not found", request, c.env);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("professor_review_report")
    .insert({
      review_id: Number(reviewId),
      reason: parsed.data.reason,
      description: parsed.data.description?.trim() || null,
      status: "pending",
    })
    .select("id,review_id,status,created_at")
    .single();

  if (insertError) {
    return fail(400, insertError.message, request, c.env);
  }

  return ok({ success: true, report: inserted }, request, c.env);
});

export default professorReviewsRoutes;
