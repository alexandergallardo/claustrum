import { createClient } from "@supabase/supabase-js";

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
};

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

async function verifyTurnstileToken(token: string, env: Env, remoteIp: string | null): Promise<boolean> {
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

  const data = await response.json() as { success?: boolean };
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
      if (path === "/upload" && request.method === "POST") {
        return await handleUpload(request, env);
      }

      if (path === "/signed-url" && request.method === "GET") {
        return await handleSignedUrl(request, env);
      }

      if (path === "/moderate" && request.method === "POST") {
        return await handleModerate(request, env);
      }

      return badRequest("Not found");
    } catch (error) {
      console.error("Worker error:", error);
      return badRequest(error instanceof Error ? error.message : "Internal error");
    }
  },
};

async function handleUpload(request: Request, env: Env): Promise<Response> {
  const userId = await verifyAuth(request, env);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const formData = await request.formData();
  const evaluationFile = formData.get("evaluationFile") as File | null;
  const answersFile = formData.get("answersFile") as File | null;

  const courseId = Number(formData.get("courseId"));
  const academicTermId = formData.get("academicTermId") ? Number(formData.get("academicTermId")) : null;
  const professorId = formData.get("professorId") ? Number(formData.get("professorId")) : null;
  const evaluationType = formData.get("evaluationType") as string;
  const evaluationNumber = formData.get("evaluationNumber") ? Number(formData.get("evaluationNumber")) : null;
  const customName = formData.get("customName") as string | null;
  const isCatedra = formData.get("isCatedra") === "true";
  const includesAnswers = formData.get("includesAnswers") === "true";
  const hasSeparateAnswers = formData.get("hasSeparateAnswers") === "true";
  const turnstileToken = formData.get("turnstileToken");

  if (typeof turnstileToken !== "string" || turnstileToken.trim() === "") {
    return badRequest("Se requiere completar la verificación humana");
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    return badRequest("Turnstile no está configurado en el servidor");
  }

  const remoteIp = request.headers.get("CF-Connecting-IP");
  const isHuman = await verifyTurnstileToken(turnstileToken, env, remoteIp);
  if (!isHuman) {
    return badRequest("No se pudo verificar el captcha");
  }

  if (!evaluationFile || evaluationFile.type !== "application/pdf") {
    return badRequest("Se requiere un archivo PDF válido");
  }

  if (evaluationFile.size > 10 * 1024 * 1024) {
    return badRequest("El archivo excede el límite de 10 MB");
  }

  // Upload to R2
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
      return badRequest("El archivo de respuestas excede el límite de 10 MB");
    }
    answersKey = `evaluations/${courseId}/${crypto.randomUUID()}_answers.pdf`;
    await env.EVALUATIONS_BUCKET.put(answersKey, answersFile.stream(), {
      httpMetadata: { contentType: "application/pdf" },
    });
  }

  // Save to Supabase
  const fileSha256 = formData.get("fileSha256") as string | null;
  const answersFileSha256 = formData.get("answersFileSha256") as string | null;

  const supabase = getSupabase(env);
  const { error: dbError } = await supabase.from("course_evaluations").insert({
    course_id: courseId,
    academic_term_id: academicTermId,
    professor_id: professorId,
    uploaded_by: userId,
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
    // Cleanup R2
    await env.EVALUATIONS_BUCKET.delete(fileKey);
    if (answersKey) await env.EVALUATIONS_BUCKET.delete(answersKey);
    throw dbError;
  }

  return ok({ success: true, message: "Evaluación subida correctamente" });
}

async function handleSignedUrl(request: Request, env: Env): Promise<Response> {
  const userId = await verifyAuth(request, env);

  const url = new URL(request.url);
  const fileKey = url.searchParams.get("key");
  if (!fileKey) return badRequest("Se requiere file key");

  // Verify user has access to this evaluation
  const supabase = getSupabase(env);
  const { data: evaluation } = await supabase
    .from("course_evaluations")
    .select("id, status, uploaded_by")
    .eq("file_key", fileKey)
    .single();

  if (!evaluation) return badRequest("Evaluación no encontrada");

  // Check access: approved evaluations are public, pending/rejected only for owner or admin
  if (evaluation.status !== "approved") {
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    if (evaluation.uploaded_by !== userId) {
      const admin = await isAdmin(userId, env);
      if (!admin) return badRequest("No tienes acceso a esta evaluación");
    }
  }

  // Stream PDF directly from R2
  const object = await env.EVALUATIONS_BUCKET.get(fileKey);
  if (!object) return badRequest("Archivo no encontrado");

  return new Response(object.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": object.httpMetadata?.contentType ?? "application/pdf",
      "Content-Length": String(object.size),
      "Cache-Control": "private, max-age=3600",
    },
  });
}

async function handleModerate(request: Request, env: Env): Promise<Response> {
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

  const body = await request.json() as { evaluationId: number; status: "approved" | "rejected"; note?: string };

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
