import { Hono } from "hono";
import { Pool } from "pg";

import type { Env } from "../types";

import { createAuth } from "../auth";

const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.on(["GET", "POST"], "/*", async (c) => {
  const connectionString = c.env.HYPERDRIVE
    ? c.env.HYPERDRIVE.connectionString
    : c.env.DATABASE_URL;

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10000,
    options: "-c search_path=better_auth,public",
  });

  try {
    const response = await createAuth(c.env, pool).handler(c.req.raw);
    if (!response) return c.notFound();
    return response;
  } finally {
    c.executionCtx.waitUntil(pool.end().catch(() => {}));
  }
});

export default authRoutes;
