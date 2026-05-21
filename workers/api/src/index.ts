import { createClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { importJWK, jwtVerify, type JWK } from "jose";
import { Pool } from "pg";
import { z } from "zod";

import { createAuth, type AuthEnv } from "./auth";

export interface Env extends AuthEnv {
  HYPERDRIVE?: Hyperdrive;
  EVALUATIONS_BUCKET: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  CORS_ORIGINS?: string;
}

const baseCorsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Disposition",
};

function getAllowedOrigins(env: Env): string[] {
  return [
    env.BETTER_AUTH_URL,
    ...(env.CORS_ORIGINS?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? []),
  ];
}

function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowedOrigins = getAllowedOrigins(env);
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : env.BETTER_AUTH_URL;
  return {
    ...baseCorsHeaders,
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Credentials": "true",
  };
}

const REVIEW_TAGS = [
  "Da buena retroalimentacion",
  "Tomaria su clase nuevamente",
  "Brinda apoyo",
  "Explica con claridad",
  "Examenes retadores",
  "Proyecto util",
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

function isRealProfessorName(fullName: string): boolean {
  const normalized = fullName.trim().toLowerCase();
  if (normalized.length === 0) return false;
  if (/sin\s+profesor\s+asignado/i.test(fullName)) return false;
  if (/se\s+imparte\s+en\s+idioma\s+ingles/i.test(fullName)) return false;
  return true;
}

function badRequest(message: string, request?: Request, env?: Env) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: {
      ...(request && env ? getCorsHeaders(request, env) : baseCorsHeaders),
      "Content-Type": "application/json",
    },
  });
}

function ok(data: unknown, request?: Request, env?: Env) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      ...(request && env ? getCorsHeaders(request, env) : baseCorsHeaders),
      "Content-Type": "application/json",
    },
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
  if (!env.SUPABASE_JWT_PRIVATE_JWK) return null;

  try {
    const publicJwk = JSON.parse(env.SUPABASE_JWT_PRIVATE_JWK) as JWK & { d?: string };
    delete publicJwk.d;
    const key = await importJWK(publicJwk, "ES256");
    const { payload } = await jwtVerify(token, key, {
      issuer: `${env.SUPABASE_URL}/auth/v1`,
      audience: "authenticated",
    });
    if (payload.role !== "authenticated" || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
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

const app = new Hono<{ Bindings: Env }>();

app.use(
  "/api/*",
  cors({
    origin: (origin, c) => {
      const allowedOrigins = getAllowedOrigins(c.env);
      if (origin && allowedOrigins.includes(origin)) return origin;
      return c.env.BETTER_AUTH_URL;
    },
    allowHeaders: ["Authorization", "X-Client-Info", "Apikey", "Content-Type"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Disposition", "Content-Length", "set-auth-jwt"],
    credentials: true,
  }),
);

app.on(["GET", "POST"], "/api/auth/**", async (c) => {
  const connectionString = c.env.HYPERDRIVE
    ? c.env.HYPERDRIVE.connectionString
    : c.env.DATABASE_URL;

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  try {
    await pool.query("SET search_path TO better_auth");
    const response = await createAuth(c.env, pool).handler(c.req.raw);

    if (!response) return c.notFound();

    const corsHeaders = getCorsHeaders(c.req.raw, c.env);
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
      headers.set(key, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } finally {
    c.executionCtx.waitUntil(pool.end().catch(() => {}));
  }
});
app.post("/api/evaluations/upload", async (c) => handleEvaluationUpload(c.req.raw, c.env));
app.get("/api/evaluations/:id/file", async (c) =>
  handleEvaluationFileById(c.req.raw, c.env, Number(c.req.param("id"))),
);
app.post("/api/evaluations/moderate", async (c) => handleEvaluationModerate(c.req.raw, c.env));
app.post("/api/professor-reviews", async (c) => handleSubmitProfessorReview(c.req.raw, c.env));

app.notFound((c) => badRequest("Not found", c.req.raw, c.env));
app.onError((error, c) => badRequest(error.message, c.req.raw, c.env));

export default app;

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
    return badRequest("Se requiere completar la verificacion humana", request, env);
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    return badRequest("Turnstile no esta configurado en el servidor", request, env);
  }

  const remoteIp = request.headers.get("CF-Connecting-IP");
  const isHuman = await verifyTurnstileToken(turnstileToken, env, remoteIp);
  if (!isHuman) {
    return badRequest("No se pudo verificar el captcha", request, env);
  }

  if (!evaluationFile || evaluationFile.type !== "application/pdf") {
    return badRequest("Se requiere un archivo PDF valido", request, env);
  }

  if (evaluationFile.size > 10 * 1024 * 1024) {
    return badRequest("El archivo excede el limite de 10 MB", request, env);
  }

  const fileKey = `evaluations/${courseId}/${crypto.randomUUID()}.pdf`;
  await env.EVALUATIONS_BUCKET.put(fileKey, evaluationFile.stream(), {
    httpMetadata: { contentType: "application/pdf" },
  });

  let answersKey: string | null = null;
  if (hasSeparateAnswers && answersFile) {
    if (answersFile.type !== "application/pdf") {
      return badRequest("El archivo de respuestas debe ser PDF", request, env);
    }
    if (answersFile.size > 10 * 1024 * 1024) {
      return badRequest("El archivo de respuestas excede el limite de 10 MB", request, env);
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

  return ok({ success: true, message: "Evaluacion subida correctamente" }, request, env);
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

  if (error || !evaluation) return badRequest("Evaluacion no encontrada", request, env);

  if (evaluation.status !== "approved") {
    const userId = await verifyAuth(request, env);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: getCorsHeaders(request, env),
      });
    }

    const admin = await isAdmin(userId, env);
    if (!admin) return badRequest("No tienes acceso a esta evaluacion", request, env);
  }

  const object = await env.EVALUATIONS_BUCKET.get(evaluation.file_key);
  if (!object) return badRequest("Archivo no encontrado", request, env);

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
      ...getCorsHeaders(request, env),
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
      headers: getCorsHeaders(request, env),
    });
  }

  const admin = await isAdmin(userId, env);
  if (!admin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: getCorsHeaders(request, env),
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
  return ok({ success: true }, request, env);
}

async function handleSubmitProfessorReview(request: Request, env: Env): Promise<Response> {
  const body = await request.json();
  const parsed = professorReviewSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid review payload", request, env);
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: "Missing Turnstile secret configuration" }), {
      status: 500,
      headers: { ...getCorsHeaders(request, env), "Content-Type": "application/json" },
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
      headers: { ...getCorsHeaders(request, env), "Content-Type": "application/json" },
    });
  }

  const turnstileJson = (await turnstileVerification.json()) as {
    success: boolean;
    "error-codes"?: string[];
  };
  if (!turnstileJson.success) {
    return badRequest("Invalid anti-spam token", request, env);
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
      headers: { ...getCorsHeaders(request, env), "Content-Type": "application/json" },
    });
  }

  if (!course) {
    return badRequest("Course code does not exist", request, env);
  }

  const { data: professorExists, error: professorError } = await supabase
    .from("professor")
    .select("id,full_name")
    .eq("id", parsed.data.professorId)
    .maybeSingle();

  if (professorError) {
    return new Response(JSON.stringify({ error: professorError.message }), {
      status: 400,
      headers: { ...getCorsHeaders(request, env), "Content-Type": "application/json" },
    });
  }

  if (!professorExists) {
    return badRequest("Professor does not exist", request, env);
  }

  if (!isRealProfessorName(professorExists.full_name)) {
    return badRequest("Professor is not eligible for reviews", request, env);
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
      return new Response(JSON.stringify({ error: termMatchError.message }), {
        status: 400,
        headers: { ...getCorsHeaders(request, env), "Content-Type": "application/json" },
      });
    }

    if (!termMatch) {
      return badRequest("Professor has no offering records for that academic term", request, env);
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
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 400,
      headers: { ...getCorsHeaders(request, env), "Content-Type": "application/json" },
    });
  }

  return ok({ success: true, review: inserted }, request, env);
}
