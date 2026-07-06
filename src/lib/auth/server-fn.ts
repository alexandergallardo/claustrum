import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { getSession } from "@/lib/auth/client";

export const getAuthSessionServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const req = getRequest();
  if (!req) return null;

  const fetchHeaders: Record<string, string> = {};
  const cookie = req.headers.get("cookie");
  const authorization = req.headers.get("authorization");

  if (cookie) fetchHeaders.cookie = cookie;
  if (authorization) fetchHeaders.authorization = authorization;

  const { data, error } = await getSession({
    fetchOptions: {
      headers: fetchHeaders,
    },
  });

  if (error) {
    throw new Error(error.message || `Auth fetch failed with status: ${error.status}`);
  }

  return data;
});
