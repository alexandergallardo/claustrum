import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export interface Env {
  EVALUATIONS_BUCKET: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  TURNSTILE_SECRET_KEY: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Disposition",
};

const REVIEW_TAGS = [
  "Da buena retroalimentacion",
  "Tomaria su clase nuevamente",
  "Brinda apoyo",
  "Explica con claridad",
  "Examenes retadores",
  "Proyecto util",
] as const;

const professorReviewSchema = z.object({
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

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSupabase(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
}

async function verifyTurnstileToken(
  token: string,
  env: Env,
  remoteIp: string | null,
): Promise<boolean> {
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
      ...(remoteIp ? { remoteip: remoteIp } : {}),
    }),
  });

  if (!response.ok) return false;

  const data = (await response.json()) as { success?: boolean };
  return data.success === true;
}

async function verifyAuth(request: Request, env: Env): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const supabase = getSupabase(env);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

async function isAdmin(userId: string, env: Env): Promise<boolean> {
  const supabase = getSupabase(env);
  const { data, error } = await supabase
    .from("user_role")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/evaluations/upload" && request.method === "POST") {
        return await handleEvaluationUpload(request, env);
      }

      const fileMatch = path.match(/^\/evaluations\/(\d+)\/file$/);
      if (fileMatch && request.method === "GET") {
        return await handleEvaluationFileById(request, env, parseInt(fileMatch[1], 10));
      }

      if (path === "/evaluations/moderate" && request.method === "POST") {
        return await handleEvaluationModerate(request, env);
      }

      if (path === "/professor-reviews" && request.method === "POST") {
        return await handleSubmitProfessorReview(request, env);
      }

      return badRequest("Not found");
    } catch (error) {
      // console.error("Worker error:", error);
      return badRequest(error instanceof Error ? error.message : "Internal error");
    }
  },
};

async function handleEvaluationUpload(request: Request, env: Env): Promise<Response> {
  const formData = await request.formData();
  const evaluationFile = formData.get("evaluationFile") as File | null;
  const answersFile = formData.get("answersFile") as File | null;

  const courseId = Number(formData.get("courseId"));
  const academicTermId = formData.get("academicTermId")
    ? Number(formData.get("academicTermId"))
    : null;
  const professorId = formData.get("professorId") ? Number(formData.get("professorId")) : null;
  const evaluationType = formData.get("evaluationType") as string;
  const evaluationNumber = formData.get("evaluationNumber")
    ? Number(formData.get("evaluationNumber"))
    : null;
  const customName = formData.get("customName") as string | null;
  const isCatedra = formData.get("isCatedra") === "true";
  const includesAnswers = formData.get("includesAnswers") === "true";
  const hasSeparateAnswers = formData.get("hasSeparateAnswers") === "true";
  const turnstileToken = formData.get("turnstileToken");

  if (typeof turnstileToken !== "string" || turnstileToken.trim() === "") {
    return badRequest("Se requiere completar la verificacion humana");
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    return badRequest("Turnstile no esta configurado en el servidor");
  }

  const remoteIp = request.headers.get("CF-Connecting-IP");
  const isHuman = await verifyTurnstileToken(turnstileToken, env, remoteIp);
  if (!isHuman) {
    return badRequest("No se pudo verificar el captcha");
  }

  if (!evaluationFile || evaluationFile.type !== "application/pdf") {
    return badRequest("Se requiere un archivo PDF valido");
  }

  if (evaluationFile.size > 10 * 1024 * 1024) {
    return badRequest("El archivo excede el limite de 10 MB");
  }

  const fileKey = `evaluations/${courseId}/${crypto.randomUUID()}.pdf`;
  await env.EVALUATIONS_BUCKET.put(fileKey, evaluationFile.stream(), {
    httpMetadata: { contentType: "application/pdf" },
  });

  let answersKey: string | null = null;
  if (hasSeparateAnswers && answersFile) {
    if (answersFile.type !== "application/pdf") {
      return badRequest("El archivo de respuestas debe ser PDF");
    }
    if (answersFile.size > 10 * 1024 * 1024) {
      return badRequest("El archivo de respuestas excede el limite de 10 MB");
    }
    answersKey = `evaluations/${courseId}/${crypto.randomUUID()}_answers.pdf`;
    await env.EVALUATIONS_BUCKET.put(answersKey, answersFile.stream(), {
      httpMetadata: { contentType: "application/pdf" },
    });
  }

  const fileSha256 = formData.get("fileSha256") as string | null;
  const answersFileSha256 = formData.get("answersFileSha256") as string | null;

  const supabase = getSupabase(env);
  const { error: dbError } = await supabase.from("course_evaluations").insert({
    course_id: courseId,
    academic_term_id: academicTermId,
    professor_id: professorId,
    evaluation_type: evaluationType,
    evaluation_number: evaluationNumber,
    custom_name: customName && customName.trim() !== "" ? customName.trim() : null,
    is_catedra: isCatedra,
    includes_answers: includesAnswers,
    has_separate_answers: hasSeparateAnswers,
    file_key: fileKey,
    file_size: evaluationFile.size,
    file_sha256: fileSha256 ?? "",
    answers_file_key: answersKey,
    answers_file_size: answersFile?.size ?? null,
    answers_file_sha256: answersFileSha256 ?? null,
    status: "pending",
  });

  if (dbError) {
    await env.EVALUATIONS_BUCKET.delete(fileKey);
    if (answersKey) await env.EVALUATIONS_BUCKET.delete(answersKey);
    throw dbError;
  }

  return ok({ success: true, message: "Evaluacion subida correctamente" });
}

function formatFileName(
  courseCode: string | null,
  evaluationType: string | null,
  evaluationNumber: number | null,
  customName: string | null,
): string {
  if (evaluationType === "otro" && customName && customName.trim() !== "") {
    return `${courseCode ?? "evaluacion"}-${customName.trim()}.pdf`;
  }

  if (!evaluationType) return `${courseCode ?? "evaluacion"}.pdf`;

  const base = `${courseCode ?? "evaluacion"}-${evaluationType.toUpperCase()}`;
  if (evaluationNumber && evaluationNumber > 0) {
    return `${base}-${evaluationNumber}.pdf`;
  }
  return `${base}.pdf`;
}

async function handleEvaluationFileById(
  request: Request,
  env: Env,
  evaluationId: number,
): Promise<Response> {
  const supabase = getSupabase(env);
  const { data: evaluation, error } = await supabase
    .from("course_evaluations")
    .select(
      "id, status, file_key, evaluation_type, evaluation_number, custom_name, course:course_id!inner(code)",
    )
    .eq("id", evaluationId)
    .single();

  if (error || !evaluation) return badRequest("Evaluacion no encontrada");

  if (evaluation.status !== "approved") {
    const userId = await verifyAuth(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const admin = await isAdmin(userId, env);
    if (!admin) return badRequest("No tienes acceso a esta evaluacion");
  }

  const object = await env.EVALUATIONS_BUCKET.get(evaluation.file_key);
  if (!object) return badRequest("Archivo no encontrado");

  const courseCode = (evaluation.course as { code: string } | null)?.code ?? null;
  const fileName = formatFileName(
    courseCode,
    evaluation.evaluation_type,
    evaluation.evaluation_number,
    evaluation.custom_name,
  );

  return new Response(object.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Length": String(object.size),
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

async function handleEvaluationModerate(request: Request, env: Env): Promise<Response> {
  const userId = await verifyAuth(request, env);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const admin = await isAdmin(userId, env);
  if (!admin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: corsHeaders,
    });
  }

  const body = (await request.json()) as {
    evaluationId: number;
    status: "approved" | "rejected";
    note?: string;
  };

  const supabase = getSupabase(env);
  const { error } = await supabase
    .from("course_evaluations")
    .update({
      status: body.status,
      moderation_note: body.note || null,
      moderated_by: userId,
      moderated_at: new Date().toISOString(),
    })
    .eq("id", body.evaluationId);

  if (error) throw error;
  return ok({ success: true });
}

async function handleSubmitProfessorReview(request: Request, env: Env): Promise<Response> {
  const body = await request.json();
  const parsed = professorReviewSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid review payload");
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: "Missing Turnstile secret configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ip = request.headers.get("cf-connecting-ip") ?? undefined;
  const turnstileBody = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: parsed.data.turnstileToken,
  });
  if (ip) turnstileBody.set("remoteip", ip);

  const turnstileVerification = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: turnstileBody,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );

  if (!turnstileVerification.ok) {
    return new Response(JSON.stringify({ error: "Could not verify anti-spam token" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const turnstileJson = (await turnstileVerification.json()) as {
    success: boolean;
    "error-codes"?: string[];
  };
  if (!turnstileJson.success) {
    return badRequest("Invalid anti-spam token");
  }

  const supabase = getSupabase(env);

  const { data: course, error: courseError } = await supabase
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

  const { data: professorExists, error: professorError } = await supabase
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

  const { data: inserted, error: insertError } = await supabase
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

  return ok({ success: true, review: inserted });
}
