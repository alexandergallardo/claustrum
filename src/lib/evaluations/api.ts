import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { getEvaluationWorkerUrl } from "@/lib/env/public";
import type {
  EvaluationRow,
  EvaluationModerationRow,
  EvaluationStatus,
  UploadEvaluationPayload,
} from "@/lib/evaluations/types";

async function sha256File(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getCourseEvaluations(courseId: number): Promise<EvaluationRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("get_course_evaluations", {
    p_course_id: courseId,
  });
  if (error) throw error;
  return (data ?? []) as EvaluationRow[];
}

export async function getEvaluationModerationQueue(
  status: EvaluationStatus,
  limit: number,
  offset: number,
): Promise<EvaluationModerationRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("get_evaluation_moderation_queue", {
    p_status: status,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return (data ?? []) as EvaluationModerationRow[];
}

export async function uploadEvaluation(payload: UploadEvaluationPayload): Promise<void> {
  const workerUrl = getEvaluationWorkerUrl();
  if (!workerUrl) {
    throw new Error("Worker URL no configurado");
  }

  const supabase = getSupabaseBrowserClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Debes iniciar sesión para subir evaluaciones");
  }

  const [fileSha256, answersFileSha256] = await Promise.all([
    sha256File(payload.evaluationFile),
    payload.answersFile ? sha256File(payload.answersFile) : Promise.resolve(""),
  ]);

  const formData = new FormData();
  formData.append("evaluationFile", payload.evaluationFile);
  if (payload.answersFile) {
    formData.append("answersFile", payload.answersFile);
  }
  formData.append("courseId", String(payload.courseId));
  if (payload.academicTermId) {
    formData.append("academicTermId", String(payload.academicTermId));
  }
  if (payload.professorId) {
    formData.append("professorId", String(payload.professorId));
  }
  formData.append("evaluationType", payload.evaluationType);
  if (payload.evaluationNumber) {
    formData.append("evaluationNumber", String(payload.evaluationNumber));
  }
  if (payload.customName) {
    formData.append("customName", payload.customName);
  }
  formData.append("isCatedra", String(payload.isCatedra));
  formData.append("includesAnswers", String(payload.includesAnswers));
  formData.append("hasSeparateAnswers", String(payload.hasSeparateAnswers));
  formData.append("turnstileToken", payload.turnstileToken);
  formData.append("fileSha256", fileSha256);
  if (payload.answersFile) {
    formData.append("answersFileSha256", answersFileSha256);
  }

  const response = await fetch(`${workerUrl}/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Error desconocido" }));
    throw new Error(body.error ?? `Error ${response.status}`);
  }
}

export async function getEvaluationSignedUrl(fileKey: string): Promise<string> {
  const workerUrl = getEvaluationWorkerUrl();
  if (!workerUrl) {
    throw new Error("Worker URL no configurado");
  }

  const supabase = getSupabaseBrowserClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Debes iniciar sesión para ver evaluaciones");
  }

  const response = await fetch(
    `${workerUrl}/signed-url?key=${encodeURIComponent(fileKey)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Error desconocido" }));
    throw new Error(body.error ?? `Error ${response.status}`);
  }

  const result = (await response.json()) as { signedUrl: string };
  return result.signedUrl;
}

export async function moderateEvaluation(
  evaluationId: number,
  status: "approved" | "rejected",
  note: string,
): Promise<void> {
  const workerUrl = getEvaluationWorkerUrl();
  if (!workerUrl) {
    throw new Error("Worker URL no configurado");
  }

  const supabase = getSupabaseBrowserClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Debes iniciar sesión para moderar");
  }

  const response = await fetch(`${workerUrl}/moderate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ evaluationId, status, note: note.trim() || undefined }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Error desconocido" }));
    throw new Error(body.error ?? `Error ${response.status}`);
  }
}
