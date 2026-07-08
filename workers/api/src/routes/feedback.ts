import { Hono } from "hono";
import { z } from "zod";

import type { Env } from "../types";

import { fail, ok } from "../lib/http";
import { verifyTurnstileToken } from "../lib/security";
import { getSupabase } from "../lib/supabase";

const feedbackSchema = z.object({
  type: z.enum(["bug", "feature", "other"]),
  content: z.string().trim().min(5).max(2000),
  turnstileToken: z.string().min(1),
});

const app = new Hono<{ Bindings: Env }>();

app.post("/", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return fail(400, "Cuerpo de solicitud inválido", c.req.raw, c.env);
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, "Datos de retroalimentación inválidos", c.req.raw, c.env);
  }

  const { type, content, turnstileToken } = parsed.data;

  const isValidTurnstile = await verifyTurnstileToken(
    turnstileToken,
    c.env,
    c.req.header("cf-connecting-ip") ?? null,
  );
  if (!isValidTurnstile) {
    return fail(400, "Fallo en la validación de seguridad (Turnstile). Inténtalo de nuevo.", c.req.raw, c.env);
  }

  const supabase = getSupabase(c.env);

  const { error } = await supabase.from("user_feedback").insert({
    type,
    content,
  });

  if (error) {
    console.error("Error inserting feedback:", error);
    return fail(500, "Error interno al enviar la retroalimentación", c.req.raw, c.env);
  }

  return ok({ success: true }, c.req.raw, c.env);
});

export default app;
