import { Hono } from "hono";
import { Pool } from "pg";

import type { Env } from "../types";

import { getAuth, getDbPool } from "../lib/db";

const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.get("/me", async (c) => {
  const pool = getDbPool(c.env);
  const auth = getAuth(c.env, pool);

  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session || !session.user) {
      return c.json({ session: null, user: null, profileContext: null, onboardingStatus: null });
    }

    const userId = session.user.id;

    const [onboardingResult, profileResult] = await Promise.all([
      pool.query(
        'SELECT onboarding_dismissed_at, onboarding_completed_at FROM public."user" WHERE id = $1',
        [userId],
      ),
      pool.query("SELECT * FROM public.get_user_profile_with_context($1)", [userId]),
    ]);

    const onboardingStatus = onboardingResult.rows[0] || null;
    const profileContext = profileResult.rows[0] || null;

    return c.json({
      session: session.session,
      user: session.user,
      onboardingStatus,
      profileContext,
    });
  } catch (error) {
    console.error("Error in /api/auth/me:", error);
    return c.json({ session: null, user: null, profileContext: null, onboardingStatus: null }, 500);
  } finally {
    c.executionCtx.waitUntil(pool.end());
  }
});

authRoutes.on(["GET", "POST"], "/*", async (c) => {
  const pool = getDbPool(c.env);
  const auth = getAuth(c.env, pool);
  try {
    const response = await auth.handler(c.req.raw);
    if (!response) return c.notFound();
    return response;
  } finally {
    c.executionCtx.waitUntil(pool.end());
  }
});

export default authRoutes;
